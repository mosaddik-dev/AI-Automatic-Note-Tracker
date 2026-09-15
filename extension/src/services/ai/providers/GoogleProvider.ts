import type { AIProvider, AIProviderConfig, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { NOTE_SYSTEM_PROMPT, buildUserPrompt, extractTitle, extractSummary } from "../prompts";
import { markdownToNotionBlocks } from "../notion";

/**
 * Google Gemini `generateContent` REST API.
 * Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
 * Request body:
 * {
 *   "systemInstruction": { "parts": [{ "text": "..." }] },
 *   "contents": [{ "role": "user", "parts": [{ "text": "..." }] }],
 *   "generationConfig": { "temperature": 0.4 }
 * }
 * Response body (success):
 * {
 *   "candidates": [{ "content": { "parts": [{ "text": "..." }] }, "finishReason": "STOP" }]
 * }
 * Error response: { "error": { "code": number, "message": string, "status": string } }
 */
export class GoogleProvider implements AIProvider {
  readonly id = "google" as const;

  async generateNote(input: NoteGenerationInput, config: AIProviderConfig): Promise<GeneratedNote> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      config.model,
    )}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    const body = {
      systemInstruction: { parts: [{ text: NOTE_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
      generationConfig: { temperature: 0.4 },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Google Gemini request failed (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const markdown: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!markdown) {
      throw new Error("Google Gemini response did not contain generated text");
    }

    const title = extractTitle(markdown, input.sessionTitle ?? "Untitled session");
    const summary = extractSummary(markdown, "");

    return {
      title,
      summary,
      markdown,
      notionBlocks: markdownToNotionBlocks(markdown),
      providerId: this.id,
    };
  }
}
