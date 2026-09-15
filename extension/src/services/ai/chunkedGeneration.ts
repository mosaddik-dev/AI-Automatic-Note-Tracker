import type { AIProviderConfig, AIProviderId, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import type { TranscriptEntry } from "@/types/session";
import { generateNoteWithFallback } from "./fallback";
import { consoleLogger, type Logger } from "./logger";
import { extractSummary, extractTitle } from "./prompts";
import { markdownToNotionBlocks } from "./notion";
import { chunkTranscriptEntries, needsChunking, tailExcerpt, totalTranscriptChars } from "./chunking";

export interface ScreenshotDescription {
  /** Index into the transcript entries array this screenshot is associated with, if any. */
  associatedTranscriptIndex?: number;
  description: string;
}

export interface ChunkedNoteInput {
  transcript: TranscriptEntry[];
  sessionTitle?: string;
  screenshots?: ScreenshotDescription[];
}

/**
 * Generates a note from a transcript that may be too long to send in a
 * single AI request. Short transcripts go through generateNoteWithFallback
 * unchanged. Long ones are split into character-budgeted chunks (see
 * chunking.ts), sent to the AI in order, each given a short tail excerpt of
 * the previous chunk for continuity (consistent terminology/language,
 * without re-summarizing it), and the resulting per-chunk Markdown is
 * concatenated into one final note. Every step is logged via `logger` (the
 * same live "ai-log" stream the UI shows) so it's clear which part is being
 * sent and how it went.
 */
export async function generateChunkedNote(
  input: ChunkedNoteInput,
  configs: AIProviderConfig[],
  logger: Logger = consoleLogger,
): Promise<GeneratedNote> {
  const { transcript, sessionTitle, screenshots = [] } = input;

  if (!needsChunking(transcript)) {
    return generateNoteWithFallback(
      {
        transcript: transcript.map((t) => t.text).join(" "),
        sessionTitle,
        screenshotDescriptions: screenshots.map((s) => s.description),
      },
      configs,
      logger,
    );
  }

  const chunks = chunkTranscriptEntries(transcript);
  logger.info(
    `transcript is ${totalTranscriptChars(transcript)} chars — too long for one request, splitting into ${chunks.length} parts`,
  );

  const noteMarkdownParts: string[] = [];
  let lastProviderId: AIProviderId | undefined;
  let previousContext = "";

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkScreenshots = screenshots
      .filter(
        (s) =>
          s.associatedTranscriptIndex != null &&
          s.associatedTranscriptIndex >= chunk.startEntryIndex &&
          s.associatedTranscriptIndex <= chunk.endEntryIndex,
      )
      .map((s) => s.description);

    logger.info(`sending part ${i + 1}/${chunks.length} to AI (${chunk.text.length} chars)…`);

    const partInput: NoteGenerationInput = {
      transcript: chunk.text,
      sessionTitle,
      screenshotDescriptions: chunkScreenshots.length ? chunkScreenshots : undefined,
      previousContext: previousContext || undefined,
      partInfo: { index: i, total: chunks.length },
    };

    const note = await generateNoteWithFallback(partInput, configs, logger);
    logger.info(`part ${i + 1}/${chunks.length} done via "${note.providerId}"`);

    noteMarkdownParts.push(note.markdown.trim());
    lastProviderId = note.providerId;
    previousContext = tailExcerpt(chunk.text);
  }

  logger.info(`merging ${chunks.length} parts into the final note`);
  const mergedMarkdown = noteMarkdownParts.join("\n\n");
  const title = extractTitle(mergedMarkdown, sessionTitle ?? "Untitled session");
  const summary = extractSummary(mergedMarkdown, "");

  return {
    title,
    summary,
    markdown: mergedMarkdown,
    notionBlocks: markdownToNotionBlocks(mergedMarkdown),
    providerId: lastProviderId ?? configs[0]?.id ?? "google",
  };
}
