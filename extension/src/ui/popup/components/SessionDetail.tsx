import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { motion } from "framer-motion";
import type { GenerationLogEntry, NoteSession } from "@/types/session";
import { deleteSession, regenerateNote } from "@/ui/shared/messaging";
import { downloadText, transcriptToText } from "@/ui/shared/download";
import { copyText } from "@/ui/shared/clipboard";
import { renderNoteMarkdown } from "@/ui/shared/renderNoteMarkdown";
import { formatElapsed } from "@/ui/shared/time";
import { SessionTimeline } from "./SessionTimeline";

interface Props {
  session: NoteSession;
  onBack: () => void;
  onDeleted: () => void;
  standalone?: boolean;
}

type Tab = "note" | "transcript" | "timeline" | "logs";

export function SessionDetail({ session, onBack, onDeleted, standalone = false }: Props) {
  const [regenerating, setRegenerating] = useState(false);
  const [tab, setTab] = useState<Tab>(session.generatedNote ? "note" : "transcript");
  const [liveLogs, setLiveLogs] = useState<GenerationLogEntry[]>(session.generationLogs ?? []);
  const [copiedWhat, setCopiedWhat] = useState<"transcript" | "note" | null>(null);
  const [pendingJumpIndex, setPendingJumpIndex] = useState<number | null>(null);
  const hasYouTubeTranscript = (session.youtubeTranscript?.length ?? 0) > 0;
  const [transcriptSource, setTranscriptSource] = useState<"recorded" | "youtube">(
    hasYouTubeTranscript ? "youtube" : "recorded",
  );
  const usingYouTube = transcriptSource === "youtube" && hasYouTubeTranscript;
  const activeTranscript = usingYouTube ? session.youtubeTranscript! : session.transcript;
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Stream "ai-log" events for this session while it's regenerating; the
  // final log set also arrives persisted on session.generationLogs once the
  // background broadcasts session-updated on completion.
  useEffect(() => {
    setLiveLogs(session.generationLogs ?? []);
    const listener = (message: any) => {
      if (message?.type === "ai-log" && message.sessionId === session.id) {
        setLiveLogs((prev) => [...prev, message.entry as GenerationLogEntry]);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    if (tab === "logs") {
      logsEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [liveLogs, tab]);

  // Timeline markers switch to the Transcript tab then scroll to the entry
  // once it's actually mounted (it isn't yet during the same render as the
  // tab switch).
  useEffect(() => {
    if (tab === "transcript" && pendingJumpIndex != null) {
      document.getElementById(`transcript-entry-${pendingJumpIndex}`)?.scrollIntoView({ block: "center" });
      setPendingJumpIndex(null);
    }
  }, [tab, pendingJumpIndex]);

  function handleJumpToEntry(entryIndex: number) {
    setPendingJumpIndex(entryIndex);
    setTab("transcript");
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setLiveLogs([]);
    setTab("logs");
    try {
      await regenerateNote(session.id, usingYouTube ? "youtube" : "recorded");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    await deleteSession(session.id);
    onDeleted();
  }

  function handleOpenFullView() {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`src/ui/popup/index.html?sessionId=${session.id}&view=tab`),
    });
  }

  function handleExportTranscript() {
    const suffix = usingYouTube ? "youtube-transcript" : "transcript";
    downloadText(
      `${sanitizeFilename(session.title)}-${suffix}.txt`,
      transcriptToText(session.title, activeTranscript, usingYouTube),
    );
  }

  function handleExportNote() {
    if (!session.generatedNote) return;
    downloadText(`${sanitizeFilename(session.title)}-note.md`, session.generatedNote.markdown, "text/markdown");
  }

  async function handleCopyTranscript() {
    const ok = await copyText(transcriptToText(session.title, activeTranscript, usingYouTube));
    if (ok) {
      setCopiedWhat("transcript");
      setTimeout(() => setCopiedWhat((prev) => (prev === "transcript" ? null : prev)), 1500);
    }
  }

  async function handleCopyNote() {
    if (!session.generatedNote) return;
    const ok = await copyText(session.generatedNote.markdown);
    if (ok) {
      setCopiedWhat("note");
      setTimeout(() => setCopiedWhat((prev) => (prev === "note" ? null : prev)), 1500);
    }
  }

  const bodyMaxHeight = standalone ? "" : "max-h-96";

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className={`${bodyMaxHeight} overflow-y-auto px-4 py-3`}
    >
      <div className="mb-2 flex items-center justify-between">
        <button onClick={onBack} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
          ← Back
        </button>
        {!standalone && (
          <button
            onClick={handleOpenFullView}
            className="text-[11px] font-medium text-neutral-500 transition-colors hover:text-indigo-400"
            title="Open this session in a full browser tab"
          >
            Open full view ↗
          </button>
        )}
      </div>

      <h2 className="text-sm font-semibold text-neutral-100">
        {session.title || "Untitled session"}
      </h2>
      <div className="mb-3 mt-0.5 text-[11px] text-neutral-500">
        {new Date(session.createdAt).toLocaleString()} · {session.status}
      </div>

      {session.screenshots.length > 0 && (
        <div className="mb-3 text-[11px] text-neutral-500">
          {session.screenshots.length} screenshot{session.screenshots.length === 1 ? "" : "s"} captured — see the
          Transcript tab for where each one was taken.
        </div>
      )}

      {hasYouTubeTranscript && (
        <div className="mb-2 flex items-center gap-2 text-[11px]">
          <span className="text-neutral-500">Transcript source:</span>
          <div className="flex gap-1 rounded-md border border-white/5 bg-white/[0.02] p-0.5">
            <button
              onClick={() => setTranscriptSource("recorded")}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                !usingYouTube ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Recorded ({session.transcript.length})
            </button>
            <button
              onClick={() => setTranscriptSource("youtube")}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                usingYouTube ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              YouTube captions ({session.youtubeTranscript?.length ?? 0})
            </button>
          </div>
        </div>
      )}

      <div className="mb-2 flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
        <TabButton active={tab === "note"} onClick={() => setTab("note")}>
          Note
        </TabButton>
        <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")}>
          Transcript ({activeTranscript.length})
        </TabButton>
        <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
          Timeline
        </TabButton>
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>
          Logs {liveLogs.length > 0 ? `(${liveLogs.length})` : ""}
        </TabButton>
      </div>

      {tab === "note" && (
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs leading-relaxed text-neutral-300">
          {session.generatedNote ? (
            renderNoteMarkdown(session.generatedNote.markdown)
          ) : (
            <p>Note not generated yet — check the Transcript tab, or click Regenerate note below.</p>
          )}
        </div>
      )}

      {tab === "transcript" && (
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs leading-relaxed text-neutral-300">
          {activeTranscript.length === 0 && session.screenshots.length === 0 ? (
            <p className="text-neutral-500">No transcript captured yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {activeTranscript.map((entry, i) => (
                <li key={i} id={`transcript-entry-${i}`}>
                  <div className="flex gap-2">
                    <span className="shrink-0 tabular-nums text-neutral-600">
                      {usingYouTube ? formatElapsed(entry.timestampMs) : new Date(entry.timestampMs).toLocaleTimeString()}
                    </span>
                    <span>{entry.text}</span>
                  </div>
                  {!usingYouTube &&
                    screenshotsByTranscriptIndex(session.screenshots, i).map((shot) => (
                      <img
                        key={shot.id}
                        src={shot.dataUrl}
                        alt="screenshot taken around this point in the transcript"
                        className="ml-6 mt-1.5 max-h-40 rounded-md border border-white/10"
                      />
                    ))}
                </li>
              ))}
              {/* Screenshots taken before the first transcript entry (or with no association yet). */}
              {!usingYouTube &&
                screenshotsByTranscriptIndex(session.screenshots, undefined).map((shot) => (
                  <li key={shot.id}>
                    <img
                      src={shot.dataUrl}
                      alt="screenshot"
                      className="mt-1.5 max-h-40 rounded-md border border-white/10"
                    />
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {tab === "timeline" && <SessionTimeline session={session} onJumpToEntry={handleJumpToEntry} />}

      {tab === "logs" && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
          {liveLogs.length === 0 ? (
            <p className="text-neutral-600">
              No generation logs yet — click "Regenerate note" to see live AI provider activity here
              (which provider is called, responses, fallbacks on failure).
            </p>
          ) : (
            <>
              {liveLogs.map((entry, i) => (
                <div key={i} className={`flex gap-2 ${logLevelClass(entry.level)}`}>
                  <span className="shrink-0 tabular-nums text-neutral-600">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="break-words">{entry.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          {regenerating ? "Generating…" : "Regenerate note"}
        </button>
        <button
          onClick={handleCopyTranscript}
          disabled={activeTranscript.length === 0}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          {copiedWhat === "transcript" ? "Copied ✓" : "Copy transcript"}
        </button>
        <button
          onClick={handleExportTranscript}
          disabled={activeTranscript.length === 0}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          Export transcript
        </button>
        <button
          onClick={handleCopyNote}
          disabled={!session.generatedNote}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          {copiedWhat === "note" ? "Copied ✓" : "Copy note"}
        </button>
        <button
          onClick={handleExportNote}
          disabled={!session.generatedNote}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          Export note
        </button>
        <button
          onClick={handleDelete}
          className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ComponentChildren }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        active ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

function screenshotsByTranscriptIndex(
  screenshots: NoteSession["screenshots"],
  index: number | undefined,
): NoteSession["screenshots"] {
  return screenshots.filter((s) => s.associatedTranscriptIndex === index);
}

function sanitizeFilename(name: string): string {
  return (name || "session").replace(/[^a-z0-9\-_]+/gi, "-").slice(0, 60);
}

function logLevelClass(level: GenerationLogEntry["level"]): string {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-amber-400";
    default:
      return "text-neutral-300";
  }
}
