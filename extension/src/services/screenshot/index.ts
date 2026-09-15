import type { ScreenshotEntry, TranscriptEntry } from "@/types/session";
import { hasSignificantChange } from "./diff";
import { DEFAULT_SCREENSHOT_SETTINGS, type ScreenshotSettings } from "@/ui/shared/storageKeys";

/**
 * Message sent to the background service worker to actually perform a
 * capture (content scripts / other contexts can't call
 * `chrome.tabs.captureVisibleTab` directly — only the background/service
 * worker context can). Not yet part of `background/messages.ts`'s
 * `RuntimeMessage` union — add it there when wiring this up.
 */
export interface CaptureVisibleTabRequest {
  type: "capture-visible-tab";
  tabId: number;
}

export interface CaptureVisibleTabResponse {
  type: "capture-visible-tab-response";
  dataUrl: string | null;
}

export class IntelligentScreenshotCapture {
  private lastDataUrl: string | undefined;
  private lastCaptureAt = 0;

  constructor(private settings: ScreenshotSettings = DEFAULT_SCREENSHOT_SETTINGS) {}

  updateSettings(settings: ScreenshotSettings) {
    this.settings = settings;
  }

  /**
   * Call with a freshly captured `dataUrl` (from `chrome.tabs.captureVisibleTab`,
   * done by the caller — this class only decides whether to keep it). Returns
   * a `ScreenshotEntry` if the frame is meaningfully different from the last
   * one kept, otherwise `null`.
   */
  async maybeAccept(dataUrl: string, timestampMs: number): Promise<ScreenshotEntry | null> {
    if (!this.settings.enabled) return null;
    if (timestampMs - this.lastCaptureAt < this.settings.minIntervalMs) return null;

    const changed = await hasSignificantChange(this.lastDataUrl, dataUrl, this.settings.sensitivity);
    if (!changed) return null;

    this.lastDataUrl = dataUrl;
    this.lastCaptureAt = timestampMs;

    return {
      id: crypto.randomUUID(),
      dataUrl,
      timestampMs,
    };
  }

  reset() {
    this.lastDataUrl = undefined;
    this.lastCaptureAt = 0;
  }
}

/**
 * Sets `associatedTranscriptIndex` to the most recent transcript entry at or
 * before the screenshot's timestamp (so a note-generation step can slot the
 * screenshot next to the text that was being said when it was taken).
 */
export function associateScreenshotWithTranscript(
  screenshot: ScreenshotEntry,
  transcriptEntries: TranscriptEntry[],
): ScreenshotEntry {
  let bestIndex: number | undefined;
  for (let i = 0; i < transcriptEntries.length; i++) {
    if (transcriptEntries[i].timestampMs <= screenshot.timestampMs) {
      bestIndex = i;
    } else {
      break;
    }
  }
  return { ...screenshot, associatedTranscriptIndex: bestIndex };
}

export { hasSignificantChange } from "./diff";
