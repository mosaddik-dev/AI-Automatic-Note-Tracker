export function downloadText(filename: string, content: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    // Give the download manager time to pick up the blob before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  });
}

export function transcriptToText(session: { title: string; transcript: { text: string; timestampMs: number }[] }): string {
  const lines = session.transcript.map((entry) => {
    const t = new Date(entry.timestampMs).toLocaleTimeString();
    return `[${t}] ${entry.text}`;
  });
  return `${session.title}\n\n${lines.join("\n")}`;
}
