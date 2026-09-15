const PLACEHOLDER_PATTERN = /\[\[screenshot:(\d+)\]\]/g;

export interface NumberedScreenshot {
  /** 1-based, matching the number used when building the AI prompt (see chunkedGeneration.ts). */
  number: number;
  dataUrl: string;
}

/**
 * Replaces every "[[screenshot:N]]" placeholder the AI was instructed to
 * emit (see NOTE_SYSTEM_PROMPT) with a real Markdown image referencing that
 * screenshot's actual captured image. Placeholders referencing a number that
 * doesn't exist (the AI hallucinating one) are just dropped rather than left
 * as visible raw markup.
 */
export function resolveScreenshotPlaceholders(markdown: string, screenshots: NumberedScreenshot[]): string {
  const byNumber = new Map(screenshots.map((s) => [s.number, s.dataUrl]));
  return markdown.replace(PLACEHOLDER_PATTERN, (match, numStr) => {
    const dataUrl = byNumber.get(Number(numStr));
    return dataUrl ? `\n\n![Screenshot ${numStr}](${dataUrl})\n\n` : "";
  });
}
