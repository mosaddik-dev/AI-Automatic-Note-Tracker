import type { TranscriptEntry } from "@/types/session";

/**
 * Rough character budget per chunk of raw transcript text sent to the AI in
 * one request. There's no tokenizer here (would need one per provider), so
 * this is a conservative character-based proxy (~4 chars/token for English,
 * fewer for Bengali script, so this stays well under context limits even
 * for smaller-context models) that also leaves headroom for the system
 * prompt, screenshot descriptions, and the model's own response tokens.
 */
export const DEFAULT_CHUNK_CHAR_BUDGET = 9000;

/** How much of the end of one chunk gets carried into the next as continuity context. */
export const CHUNK_OVERLAP_CHARS = 400;

export interface TranscriptChunk {
  text: string;
  /** Inclusive index range into the original transcript entries array. */
  startEntryIndex: number;
  endEntryIndex: number;
}

export function totalTranscriptChars(entries: TranscriptEntry[]): number {
  return entries.reduce((sum, e) => sum + e.text.length + 1, 0);
}

export function needsChunking(entries: TranscriptEntry[], maxChars = DEFAULT_CHUNK_CHAR_BUDGET): boolean {
  return totalTranscriptChars(entries) > maxChars;
}

/**
 * Splits transcript entries into chunks that each stay under `maxChars`,
 * without ever splitting a single entry's text across two chunks (entries
 * are typically short ASR segments, so this is a fine granularity).
 */
export function chunkTranscriptEntries(
  entries: TranscriptEntry[],
  maxChars = DEFAULT_CHUNK_CHAR_BUDGET,
): TranscriptChunk[] {
  if (entries.length === 0) {
    return [{ text: "", startEntryIndex: 0, endEntryIndex: -1 }];
  }

  const chunks: TranscriptChunk[] = [];
  let bufferTexts: string[] = [];
  let bufferLen = 0;
  let startIdx = 0;

  for (let i = 0; i < entries.length; i++) {
    const text = entries[i].text;
    if (bufferLen + text.length > maxChars && bufferTexts.length > 0) {
      chunks.push({ text: bufferTexts.join(" "), startEntryIndex: startIdx, endEntryIndex: i - 1 });
      bufferTexts = [];
      bufferLen = 0;
      startIdx = i;
    }
    bufferTexts.push(text);
    bufferLen += text.length + 1;
  }

  chunks.push({ text: bufferTexts.join(" "), startEntryIndex: startIdx, endEntryIndex: entries.length - 1 });
  return chunks;
}

/** Last `n` characters of `text`, on a word boundary where possible (for a readable "continued from" excerpt). */
export function tailExcerpt(text: string, n = CHUNK_OVERLAP_CHARS): string {
  if (text.length <= n) return text;
  const slice = text.slice(-n);
  const spaceIdx = slice.indexOf(" ");
  return spaceIdx > 0 && spaceIdx < 40 ? slice.slice(spaceIdx + 1) : slice;
}
