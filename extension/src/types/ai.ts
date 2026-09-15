export type AIProviderId = "google" | "groq" | "openrouter";

export interface AIProviderConfig {
  id: AIProviderId;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;
}

export interface NoteGenerationInput {
  transcript: string;
  sessionTitle?: string;
  screenshotDescriptions?: string[];
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
