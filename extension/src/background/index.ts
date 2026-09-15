import type { RuntimeMessage } from "./messages";
import { ensureOffscreenDocument, closeOffscreenDocumentIfIdle } from "./offscreenManager";
import {
  addScreenshot,
  appendTranscriptEntry,
  createEmptySession,
  deleteSession,
  getSession,
  listSessions,
  saveSession,
} from "../services/storage";
import { generateChunkedNote, resolveScreenshotPlaceholders, type ScreenshotDescription } from "../services/ai";
import { createCollectingLogger } from "../services/ai/logger";
import {
  DEFAULT_SCREENSHOT_SETTINGS,
  STORAGE_KEY_AI_PROVIDER_CONFIGS,
  STORAGE_KEY_SCREENSHOT_SETTINGS,
  type ScreenshotSettings,
} from "../ui/shared/storageKeys";
import { associateScreenshotWithTranscript, IntelligentScreenshotCapture } from "../services/screenshot";
import { isYouTubeWatchUrl, tryFetchYouTubeTranscript } from "./youtubeTranscript";
import type { AIProviderConfig } from "../types/ai";
import type { GenerationLogEntry, NoteSession } from "../types/session";

interface ActiveRecording {
  sessionId: string;
  screenshotCapture: IntelligentScreenshotCapture;
  screenshotTimer: ReturnType<typeof setInterval>;
}

const activeRecordings = new Map<number, ActiveRecording>();

async function getScreenshotSettings(): Promise<ScreenshotSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_SCREENSHOT_SETTINGS);
  return (stored[STORAGE_KEY_SCREENSHOT_SETTINGS] as ScreenshotSettings | undefined) ?? DEFAULT_SCREENSHOT_SETTINGS;
}

async function captureScreenshotTick(tabId: number, sessionId: string, capture: IntelligentScreenshotCapture): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.windowId || !tab.active) {
      // chrome.tabs.captureVisibleTab only captures whichever tab is
      // currently foregrounded in that window — it can't target a specific
      // background tab. If the recorded tab isn't active right now, just
      // skip this tick rather than screenshotting the wrong page.
      return;
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 70 });
    const accepted = await capture.maybeAccept(dataUrl, Date.now());
    if (!accepted) return;

    const session = await getSession(sessionId);
    if (!session) return;
    const associated = associateScreenshotWithTranscript(accepted, session.transcript);
    const updated = await addScreenshot(sessionId, associated);
    const update: RuntimeMessage = { type: "session-updated", session: updated };
    void chrome.runtime.sendMessage(update).catch(() => undefined);
  } catch (err) {
    // Tab may have navigated away from a capturable page (chrome://, etc.),
    // or captureVisibleTab hit its rate limit — skip this tick, the interval
    // will just try again. Still log it so a persistent failure is visible
    // in the service worker's console instead of silently never capturing.
    console.warn("[screenshot] capture tick failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * There's no real image captioning here (no vision-model call per
 * screenshot) — only a timing + nearby-transcript-text description. The AI
 * is instructed (NOTE_SYSTEM_PROMPT) to mark where a screenshot belongs with
 * an exact "[[screenshot:N]]" placeholder using this same 1-based `number`,
 * which resolveScreenshotPlaceholders() below then swaps for the real image.
 */
function buildScreenshotDescriptions(session: {
  screenshots: NoteSession["screenshots"];
  transcript: NoteSession["transcript"];
}): ScreenshotDescription[] {
  return session.screenshots.map((shot, i) => {
    const nearbyText =
      shot.associatedTranscriptIndex != null ? session.transcript[shot.associatedTranscriptIndex]?.text : undefined;
    const timeLabel = new Date(shot.timestampMs).toLocaleTimeString();
    const description = nearbyText
      ? `captured at ${timeLabel}, while the transcript said: "${nearbyText}"`
      : `captured at ${timeLabel}`;
    return { number: i + 1, associatedTranscriptIndex: shot.associatedTranscriptIndex, description };
  });
}

function newSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Fire-and-forget: fetches YouTube's own captions (if any) and attaches them to the session once ready. */
async function attachYouTubeTranscriptIfAvailable(tabId: number, sessionId: string): Promise<void> {
  const entries = await tryFetchYouTubeTranscript(tabId).catch(() => null);
  if (!entries) return;

  const session = await getSession(sessionId);
  if (!session) return;
  session.youtubeTranscript = entries;
  session.updatedAt = Date.now();
  await saveSession(session);
  const update: RuntimeMessage = { type: "session-updated", session };
  void chrome.runtime.sendMessage(update).catch(() => undefined);
}

async function startRecording(tabId: number): Promise<void> {
  if (activeRecordings.has(tabId)) {
    return;
  }

  const tab = await chrome.tabs.get(tabId);
  const sessionId = newSessionId();
  const session = createEmptySession(sessionId, tab.title ?? "Untitled session", tab.url);
  await saveSession(session);

  await ensureOffscreenDocument();
  const streamId = await new Promise<string>((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError || !id) {
        reject(new Error(chrome.runtime.lastError?.message ?? "getMediaStreamId failed"));
        return;
      }
      resolve(id);
    });
  });

  const screenshotSettings = await getScreenshotSettings();
  const screenshotCapture = new IntelligentScreenshotCapture(screenshotSettings);
  const screenshotTimer = setInterval(
    () => void captureScreenshotTick(tabId, sessionId, screenshotCapture),
    Math.max(screenshotSettings.minIntervalMs, 1000),
  );

  activeRecordings.set(tabId, { sessionId, screenshotCapture, screenshotTimer });

  if (isYouTubeWatchUrl(tab.url)) {
    void attachYouTubeTranscriptIfAvailable(tabId, sessionId);
  }

  const message: RuntimeMessage = { type: "capture-tab-audio", tabId, streamId, sessionId };
  await chrome.runtime.sendMessage(message);
}

async function regenerateNote(sessionId: string, source: "recorded" | "youtube" = "recorded"): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  const useYouTube = source === "youtube" && !!session.youtubeTranscript?.length;
  const transcript = useYouTube ? session.youtubeTranscript! : session.transcript;

  const logs: GenerationLogEntry[] = [];
  const logger = createCollectingLogger((entry) => {
    logs.push(entry);
    const logMessage: RuntimeMessage = { type: "ai-log", sessionId, entry };
    void chrome.runtime.sendMessage(logMessage).catch(() => undefined);
  });

  logger.info(
    useYouTube
      ? "using YouTube's caption track as the transcript source"
      : "using the recorded speech transcript",
  );

  session.status = "processing";
  session.generationLogs = logs;
  session.updatedAt = Date.now();
  await saveSession(session);
  const processingUpdate: RuntimeMessage = { type: "session-updated", session };
  void chrome.runtime.sendMessage(processingUpdate).catch(() => undefined);

  const stored = await chrome.storage.local.get(STORAGE_KEY_AI_PROVIDER_CONFIGS);
  const configs = (stored[STORAGE_KEY_AI_PROVIDER_CONFIGS] as AIProviderConfig[] | undefined) ?? [];

  try {
    // Screenshot associations (associatedTranscriptIndex) are computed
    // against `session.transcript`'s indices/timestamps — they don't line
    // up with the YouTube caption array's different indices/time base, so
    // screenshot embedding only applies when generating from the recorded
    // transcript.
    const note = await generateChunkedNote(
      {
        transcript,
        sessionTitle: session.title,
        screenshots: useYouTube ? [] : buildScreenshotDescriptions(session),
      },
      configs,
      logger,
    );
    const finalMarkdown = resolveScreenshotPlaceholders(
      note.markdown,
      session.screenshots.map((shot, i) => ({ number: i + 1, dataUrl: shot.dataUrl })),
    );
    session.generatedNote = {
      markdown: finalMarkdown,
      providerId: note.providerId,
      generatedAt: Date.now(),
    };
    session.status = "completed";
  } catch (err) {
    session.status = "stopped";
    session.generatedNote = {
      markdown: `Note generation failed: ${err instanceof Error ? err.message : String(err)}`,
      providerId: "none",
      generatedAt: Date.now(),
    };
  }
  session.generationLogs = logs;
  session.updatedAt = Date.now();
  await saveSession(session);
  const doneUpdate: RuntimeMessage = { type: "session-updated", session };
  void chrome.runtime.sendMessage(doneUpdate).catch(() => undefined);
}

async function stopRecording(tabId: number): Promise<void> {
  const recording = activeRecordings.get(tabId);
  if (!recording) {
    return;
  }
  clearInterval(recording.screenshotTimer);
  activeRecordings.delete(tabId);

  const stopMessage: RuntimeMessage = { type: "stop-tab-audio", tabId };
  await chrome.runtime.sendMessage(stopMessage);

  const session = await getSession(recording.sessionId);
  if (session) {
    session.status = "stopped";
    session.updatedAt = Date.now();
    await saveSession(session);
    if (session.transcript.length > 0) {
      void regenerateNote(recording.sessionId);
    }
  }

  await closeOffscreenDocumentIfIdle(activeRecordings.size > 0);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  switch (message.type) {
    case "start-recording":
      void startRecording(message.tabId).then(() => sendResponse({ ok: true }));
      return true;

    case "stop-recording":
      void stopRecording(message.tabId).then(() => sendResponse({ ok: true }));
      return true;

    case "get-recording-state": {
      const recording = activeRecordings.get(message.tabId);
      const response: RuntimeMessage = {
        type: "recording-state",
        tabId: message.tabId,
        recording: Boolean(recording),
        sessionId: recording?.sessionId,
      };
      sendResponse(response);
      return false;
    }

    case "transcript-segment":
      void appendTranscriptEntry(message.sessionId, {
        text: message.segment.text,
        timestampMs: message.segment.timestampMs,
      }).then((session) => {
        const update: RuntimeMessage = { type: "session-updated", session };
        void chrome.runtime.sendMessage(update).catch(() => undefined);
      });
      return false;

    case "list-sessions":
      void listSessions().then((sessions) => {
        const response: RuntimeMessage = { type: "sessions-list", sessions };
        sendResponse(response);
      });
      return true;

    case "get-session":
      void getSession(message.sessionId).then((session) => sendResponse(session));
      return true;

    case "delete-session":
      void deleteSession(message.sessionId).then(() => sendResponse({ ok: true }));
      return true;

    case "regenerate-note":
      void regenerateNote(message.sessionId, message.source).then(() => sendResponse({ ok: true }));
      return true;

    default:
      return false;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeRecordings.has(tabId)) {
    void stopRecording(tabId);
  }
});
