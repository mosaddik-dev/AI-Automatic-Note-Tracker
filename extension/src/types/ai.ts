export type AIProviderId = "google" | "groq" | "openrouter" | "custom";

export interface AIProviderConfig {
  id: AIProviderId;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;
  /** Only used when id === "custom": the OpenAI-compatible chat completions endpoint URL. */
  endpoint?: string;
}

export interface NoteGenerationInput {
  transcript: string;
  sessionTitle?: string;
  screenshotDescriptions?: string[];
  /**
   * Tail end of the previous chunk's transcript, provided only when a long
   * transcript is split into multiple parts (see services/ai/chunking.ts).
   * Given to the AI purely as continuity context — it should not repeat or
   * re-summarize this, only use it to keep terminology/tone consistent.
   */
  previousContext?: string;
  /** Present when this call is one part of a multi-part chunked transcript. */
  partInfo?: { index: number; total: number };
}

export interface GeneratedNote {
  title: string;
  summary: string;
  markdown: string;
  notionBlocks?: unknown[];
  providerId: AIProviderId;
}

export interface AIProvider {
  id: AIProviderId;
  generateNote(input: NoteGenerationInput, config: AIProviderConfig): Promise<GeneratedNote>;
}
