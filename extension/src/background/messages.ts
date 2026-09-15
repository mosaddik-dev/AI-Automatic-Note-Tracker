import type { TranscriptSegment } from "../types/transcription";
import type { GenerationLogEntry, NoteSession } from "../types/session";

export type RuntimeMessage =
  | { type: "start-recording"; tabId: number }
  | { type: "stop-recording"; tabId: number }
  | { type: "get-recording-state"; tabId: number }
  | { type: "recording-state"; tabId: number; recording: boolean; sessionId?: string }
  | { type: "capture-tab-audio"; tabId: number; streamId: string; sessionId: string }
  | { type: "stop-tab-audio"; tabId: number }
  | { type: "transcript-segment"; tabId: number; sessionId: string; segment: TranscriptSegment }
  | { type: "session-updated"; session: NoteSession }
  | { type: "list-sessions" }
  | { type: "sessions-list"; sessions: NoteSession[] }
  | { type: "get-session"; sessionId: string }
  | { type: "delete-session"; sessionId: string }
  | { type: "capture-screenshot-request"; tabId: number }
  | { type: "capture-screenshot-response"; tabId: number; pageTitle: string; pageUrl: string }
  | { type: "regenerate-note"; sessionId: string }
  | { type: "ai-log"; sessionId: string; entry: GenerationLogEntry };

export type MessageOf<T extends RuntimeMessage["type"]> = Extract<RuntimeMessage, { type: T }>;

export function sendToBackground<T extends RuntimeMessage>(message: T): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

export function sendToTab<T extends RuntimeMessage>(tabId: number, message: T): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}
