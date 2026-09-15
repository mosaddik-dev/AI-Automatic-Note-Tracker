import type { AIProvider, AIProviderConfig, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { chatCompletionOpenAiCompatible, generateNoteViaOpenAiCompatibleChat } from "./openAiCompatible";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/** Groq OpenAI-compatible chat completions: https://api.groq.com/openai/v1/chat/completions */
export class GroqProvider implements AIProvider {
  readonly id = "groq" as const;

  generateNote(input: NoteGenerationInput, config: AIProviderConfig): Promise<GeneratedNote> {
    return generateNoteViaOpenAiCompatibleChat(this.id, ENDPOINT, input, config);
  }

  complete(systemPrompt: string, userPrompt: string, config: AIProviderConfig): Promise<string> {
    return chatCompletionOpenAiCompatible(this.id, ENDPOINT, systemPrompt, userPrompt, config);
  }
}
