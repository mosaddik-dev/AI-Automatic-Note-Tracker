import type { TranscriptEntry } from "@/types/session";

/**
 * Rough character budget per chunk of raw transcript text sent to the AI in
 * one request. There's no tokenizer here (would need one per provider), so
 * this is a conservative character-based proxy for token count.
 *
 * IMPORTANT: Bengali (and other non-Latin scripts) tokenize far more
 * densely than English in most BPE tokenizers — observed in production:
 * a ~9000-character Bengali-heavy chunk produced ~31,000 tokens (~3.4
 * tokens/char), not the ~4 chars/token ballpark that holds for English.
 * Sized conservatively against the tightest limit we've actually hit —
 * Groq's on_demand free tier caps at 8000 tokens PER MINUTE, so a single
 * request's transcript portion is kept small enough (even at a
 * pessimistic ~4 tokens/char) to leave headroom for the system prompt and
 * the model's response within that budget. Providers with much larger
 * context windows (Gemini, most OpenRouter models) just do more, smaller
 * requests — a performance cost, not a correctness one.
 */
export const DEFAULT_CHUNK_CHAR_BUDGET = 1600;

/** How much of the end of one chunk gets carried into the next as continuity context. */
export const CHUNK_OVERLAP_CHARS = 150;

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
