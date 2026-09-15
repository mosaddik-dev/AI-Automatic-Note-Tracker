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
  /**
   * YouTube's own caption track for this video, fetched once at recording
   * start when the tab is a YouTube watch page (if the video has captions).
   * `timestampMs` here is video-relative (0 = video start), NOT wall-clock
   * like `transcript` — a different time base, kept as a separate array
   * rather than merged. The user picks which one to view/generate from.
   */
  youtubeTranscript?: TranscriptEntry[];
  screenshots: ScreenshotEntry[];
  generatedNote?: {
    markdown: string;
    providerId: string;
    generatedAt: number;
  };
  generationLogs?: GenerationLogEntry[];
  status: "recording" | "stopped" | "processing" | "completed";
}
