import type { AIProviderConfig, AIProviderId, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { NOTE_SYSTEM_PROMPT, buildUserPrompt, extractTitle, extractSummary } from "../prompts";
import { markdownToNotionBlocks } from "../notion";

/**
 * Shared low-level implementation for OpenAI-compatible `/chat/completions` REST APIs
 * (Groq, OpenRouter, and any user-supplied custom endpoint). Returns the raw assistant
 * text, with no note-specific structure assumed — used both for note generation and
 * for other single-shot text tasks (e.g. the post-generation language-polish pass).
 *
 * Request body:
 * { "model": string, "messages": [{ "role": "system"|"user", "content": string }], "temperature": 0.4 }
 * Response body (success): { "choices": [{ "message": { "role": "assistant", "content": "..." } }] }
 * Error response (typical): { "error": { "message": string, "type"?: string, "code"?: string } }
 */
export async function chatCompletionOpenAiCompatible(
  providerId: AIProviderId,
  endpoint: string,
  systemPrompt: string,
  userPrompt: string,
  config: AIProviderConfig,
  extraHeaders?: Record<string, string>,
): Promise<string> {
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
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${providerId} request failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const text: string | undefined = json?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`${providerId} response did not contain generated text`);
  }
  return text;
}

export async function generateNoteViaOpenAiCompatibleChat(
  providerId: AIProviderId,
  endpoint: string,
  input: NoteGenerationInput,
  config: AIProviderConfig,
  extraHeaders?: Record<string, string>,
): Promise<GeneratedNote> {
  const markdown = await chatCompletionOpenAiCompatible(
    providerId,
    endpoint,
    NOTE_SYSTEM_PROMPT,
    buildUserPrompt(input),
    config,
    extraHeaders,
  );

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
