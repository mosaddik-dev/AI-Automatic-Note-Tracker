import type { NoteSession, ScreenshotEntry, TranscriptEntry } from "../../types/session";

const DB_NAME = "note-tracker";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(SESSIONS_STORE, mode);
        const store = tx.objectStore(SESSIONS_STORE);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export function saveSession(session: NoteSession): Promise<void> {
  return runTransaction("readwrite", (store) => store.put(session)).then(() => undefined);
}

export function getSession(sessionId: string): Promise<NoteSession | undefined> {
  return runTransaction("readonly", (store) => store.get(sessionId));
}

export function listSessions(): Promise<NoteSession[]> {
  return runTransaction("readonly", (store) => store.getAll()).then((sessions) =>
    sessions.sort((a, b) => b.updatedAt - a.updatedAt),
  );
}

export function deleteSession(sessionId: string): Promise<void> {
  return runTransaction("readwrite", (store) => store.delete(sessionId)).then(() => undefined);
}

export async function appendTranscriptEntry(
  sessionId: string,
  entry: TranscriptEntry,
): Promise<NoteSession> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  session.transcript.push(entry);
  session.updatedAt = Date.now();
  await saveSession(session);
  return session;
}

export async function addScreenshot(
  sessionId: string,
  screenshot: ScreenshotEntry,
): Promise<NoteSession> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  session.screenshots.push(screenshot);
  session.updatedAt = Date.now();
  await saveSession(session);
  return session;
}

export function createEmptySession(id: string, title: string, tabUrl?: string): NoteSession {
  const now = Date.now();
  return {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    tabUrl,
    transcript: [],
    screenshots: [],
    status: "recording",
  };
}
