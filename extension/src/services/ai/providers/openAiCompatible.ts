import type { AIProviderConfig, AIProviderId, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { NOTE_SYSTEM_PROMPT, buildUserPrompt, extractTitle, extractSummary } from "../prompts";
import { markdownToNotionBlocks } from "../notion";

/**
 * Shared implementation for OpenAI-compatible `/chat/completions` REST APIs (Groq, OpenRouter).
 * Request body:
 * {
 *   "model": string,
 *   "messages": [{ "role": "system"|"user", "content": string }],
 *   "temperature": 0.4
 * }
 * Response body (success):
 * { "choices": [{ "message": { "role": "assistant", "content": "..." } }] }
 * Error response (typical): { "error": { "message": string, "type"?: string, "code"?: string } }
 */
export async function generateNoteViaOpenAiCompatibleChat(
  providerId: AIProviderId,
  endpoint: string,
  input: NoteGenerationInput,
  config: AIProviderConfig,
  extraHeaders?: Record<string, string>,
): Promise<GeneratedNote> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: NOTE_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${providerId} request failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const markdown: string | undefined = json?.choices?.[0]?.message?.content;
  if (!markdown) {
    throw new Error(`${providerId} response did not contain generated text`);
  }

  const title = extractTitle(markdown, input.sessionTitle ?? "Untitled session");
  const summary = extractSummary(markdown, "");

  return {
    title,
    summary,
    markdown,
    notionBlocks: markdownToNotionBlocks(markdown),
    providerId,
  };
}
