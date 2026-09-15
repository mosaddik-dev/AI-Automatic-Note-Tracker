import type { NoteGenerationInput } from "@/types/ai";

export const NOTE_SYSTEM_PROMPT = `You are an expert note-taker who converts raw speech transcripts (often Bengali, sometimes mixed Bengali/English, occasionally with transcription noise) into clear, well-structured study/meeting notes.

Rules:
- Preserve the meaning of the transcript faithfully. Do not invent facts, names, or numbers that are not implied by the transcript.
- Write the notes in the SAME language the transcript is predominantly in (Bengali transcript -> Bengali notes), unless the user explicitly asks for another language.
- If screenshot descriptions are provided, weave each one in at the point in the notes where it is most relevant (e.g. right after the topic it illustrates), referencing it naturally (e.g. "(see screenshot: ...)").
- Ignore filler words, false starts, and obvious ASR artifacts; do not transcribe verbatim, summarize and structure instead.
- Output valid Markdown only, with this shape:
  1. A single "# <Title>" line — a short, specific title for the session.
  2. A "## Summary" section: 2-5 sentences capturing the key takeaway.
  3. One or more "## <Topic>" sections with bullet points ("- ") for details, using **bold** for key terms, names, and numbers.
- Do not wrap the output in a code fence. Output Markdown directly, nothing else (no preamble like "Here are the notes:").`;

export function buildUserPrompt(input: NoteGenerationInput): string {
  const parts: string[] = [];
  if (input.sessionTitle) {
    parts.push(`Session title hint: ${input.sessionTitle}`);
  }
  if (input.screenshotDescriptions?.length) {
    parts.push(
      "Screenshots captured during the session (in chronological order):\n" +
        input.screenshotDescriptions.map((d, i) => `${i + 1}. ${d}`).join("\n"),
    );
  }
  parts.push("Transcript:\n" + input.transcript);
  return parts.join("\n\n");
}

/** Extracts a short title from generated markdown's leading "# " heading, if present. */
export function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

/** Extracts the "## Summary" section body from generated markdown, if present. */
export function extractSummary(markdown: string, fallback: string): string {
  const match = markdown.match(/^##\s+Summary\s*\n([\s\S]*?)(?=\n##\s+|$)/m);
  return match ? match[1].trim() : fallback;
}
