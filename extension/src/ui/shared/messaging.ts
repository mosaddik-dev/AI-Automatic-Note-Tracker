import type { RuntimeMessage } from "@/background/messages";
import type { NoteSession } from "@/types/session";

/**
 * Extra messages needed by the popup/options UI that are not yet declared in
 * `background/messages.ts`'s `RuntimeMessage` union. Whoever owns that file
 * should fold these in; kept here so the UI stays functional in the meantime.
 */
export type UiExtraMessage =
  | { type: "get-ai-provider-configs" }
  | { type: "set-ai-provider-configs"; configs: unknown[] };

export function send<T>(message: RuntimeMessage | UiExtraMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export async function listSessions(): Promise<NoteSession[]> {
  const res = await send<{ type: "sessions-list"; sessions: NoteSession[] }>({
    type: "list-sessions",
  });
  return res?.sessions ?? [];
}

export async function deleteSession(sessionId: string): Promise<void> {
  await send({ type: "delete-session", sessionId });
}

export async function regenerateNote(sessionId: string, source?: "recorded" | "youtube"): Promise<void> {
  await send({ type: "regenerate-note", sessionId, source });
}

export async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}
