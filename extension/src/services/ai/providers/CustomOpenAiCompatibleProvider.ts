import type { AIProvider, AIProviderConfig, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { generateNoteViaOpenAiCompatibleChat } from "./openAiCompatible";

/**
 * A user-supplied OpenAI-compatible `/chat/completions` endpoint (self-hosted
 * model, a provider not built in above, a proxy, etc.) — same request/response
 * shape as Groq/OpenRouter, just with the model name, endpoint URL, and API
 * key all provided by the user rather than hardcoded. Participates in the
 * same fallback chain as the built-in providers.
 */
export class CustomOpenAiCompatibleProvider implements AIProvider {
  readonly id = "custom" as const;

  generateNote(input: NoteGenerationInput, config: AIProviderConfig): Promise<GeneratedNote> {
    if (!config.endpoint) {
      throw new Error('Custom provider is enabled but has no API endpoint configured (Settings → Custom → "API endpoint")');
    }
    return generateNoteViaOpenAiCompatibleChat(this.id, config.endpoint, input, config);
  }
}
