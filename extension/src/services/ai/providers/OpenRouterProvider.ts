import type { AIProvider, AIProviderConfig, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { chatCompletionOpenAiCompatible, generateNoteViaOpenAiCompatibleChat } from "./openAiCompatible";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const EXTRA_HEADERS = { "X-Title": "AI Automatic Note Tracker" };

/**
 * OpenRouter OpenAI-compatible chat completions: https://openrouter.ai/api/v1/chat/completions
 * OpenRouter recommends (not strictly required) an `HTTP-Referer` / `X-Title` header identifying
 * the calling app; a browser extension has no stable HTTP referer, so we send a fixed `X-Title`
 * and omit `HTTP-Referer` rather than sending something misleading.
 */
export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter" as const;

  generateNote(input: NoteGenerationInput, config: AIProviderConfig): Promise<GeneratedNote> {
    return generateNoteViaOpenAiCompatibleChat(this.id, ENDPOINT, input, config, EXTRA_HEADERS);
  }

  complete(systemPrompt: string, userPrompt: string, config: AIProviderConfig): Promise<string> {
    return chatCompletionOpenAiCompatible(this.id, ENDPOINT, systemPrompt, userPrompt, config, EXTRA_HEADERS);
  }
}
