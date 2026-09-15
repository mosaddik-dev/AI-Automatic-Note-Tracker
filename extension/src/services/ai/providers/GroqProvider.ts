import type { AIProvider, AIProviderConfig, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { generateNoteViaOpenAiCompatibleChat } from "./openAiCompatible";

/** Groq OpenAI-compatible chat completions: https://api.groq.com/openai/v1/chat/completions */
export class GroqProvider implements AIProvider {
  readonly id = "groq" as const;

  generateNote(input: NoteGenerationInput, config: AIProviderConfig): Promise<GeneratedNote> {
    return generateNoteViaOpenAiCompatibleChat(
      this.id,
      "https://api.groq.com/openai/v1/chat/completions",
      input,
      config,
    );
  }
}
