import { formatElapsed } from "./time";

export function downloadText(filename: string, content: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    // Give the download manager time to pick up the blob before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  });
}

/**
 * `relative` should be true for entries whose `timestampMs` is video-relative
 * (e.g. YouTube captions, 0 = video start) rather than wall-clock epoch time
 * (the recorded transcript) — otherwise timestamps would render as nonsense
 * clock times.
 */
export function transcriptToText(
  title: string,
  entries: { text: string; timestampMs: number }[],
  relative = false,
): string {
  const lines = entries.map((entry) => {
    const label = relative ? formatElapsed(entry.timestampMs) : new Date(entry.timestampMs).toLocaleTimeString();
    return `[${label}] ${entry.text}`;
  });
  return `${title}\n\n${lines.join("\n")}`;
}
