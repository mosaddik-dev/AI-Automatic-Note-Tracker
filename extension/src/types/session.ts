export interface TranscriptEntry {
  text: string;
  timestampMs: number;
}

export interface GenerationLogEntry {
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ScreenshotEntry {
  id: string;
  dataUrl: string;
  timestampMs: number;
  associatedTranscriptIndex?: number;
}

export interface NoteSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  tabUrl?: string;
  transcript: TranscriptEntry[];
  screenshots: ScreenshotEntry[];
  generatedNote?: {
    markdown: string;
    providerId: string;
    generatedAt: number;
  };
  generationLogs?: GenerationLogEntry[];
  status: "recording" | "stopped" | "processing" | "completed";
}
