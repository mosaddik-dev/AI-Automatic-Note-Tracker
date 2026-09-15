import type { AIProvider, AIProviderConfig, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { generateNoteViaOpenAiCompatibleChat } from "./openAiCompatible";

/**
 * OpenRouter OpenAI-compatible chat completions: https://openrouter.ai/api/v1/chat/completions
 * OpenRouter recommends (not strictly required) an `HTTP-Referer` / `X-Title` header identifying
 * the calling app; a browser extension has no stable HTTP referer, so we send a fixed `X-Title`
 * and omit `HTTP-Referer` rather than sending something misleading.
 */
export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter" as const;

  generateNote(input: NoteGenerationInput, config: AIProviderConfig): Promise<GeneratedNote> {
    return generateNoteViaOpenAiCompatibleChat(
      this.id,
      "https://openrouter.ai/api/v1/chat/completions",
      input,
      config,
      { "X-Title": "AI Automatic Note Tracker" },
    );
  }
}
