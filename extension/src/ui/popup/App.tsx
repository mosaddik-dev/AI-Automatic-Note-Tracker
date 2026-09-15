import { useEffect, useState, useCallback } from "preact/hooks";
import { AnimatePresence } from "framer-motion";
import type { NoteSession } from "@/types/session";
import { listSessions } from "@/ui/shared/messaging";
import { GlowBorder } from "@/ui/shared/GlowBorder";
import { RecordButton } from "./components/RecordButton";
import { SessionList } from "./components/SessionList";
import { SessionDetail } from "./components/SessionDetail";

const params = new URLSearchParams(location.search);
const initialSessionId = params.get("sessionId");
const standalone = params.get("view") === "tab";

export function App() {
  const [sessions, setSessions] = useState<NoteSession[]>([]);
  const [selected, setSelected] = useState<NoteSession | null>(null);
  const [recording, setRecording] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(initialSessionId);

  const refresh = useCallback(async () => {
    const list = await listSessions();
    setSessions(list);
    setSelected((prev) => {
      if (prev) return list.find((s) => s.id === prev.id) ?? null;
      return prev;
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("standalone", standalone);
  }, []);

  useEffect(() => {
    refresh();
    const listener = (message: any) => {
      if (message?.type === "session-updated" || message?.type === "recording-state") {
        refresh();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [refresh]);

  // Deep-link support for "Open full view": select the requested session as
  // soon as it shows up in the loaded list (it may load after this mounts).
  useEffect(() => {
    if (!pendingSessionId) return;
    const match = sessions.find((s) => s.id === pendingSessionId);
    if (match) {
      setSelected(match);
      setPendingSessionId(null);
    }
  }, [sessions, pendingSessionId]);

  return (
    <div
      className={
        standalone
          ? "min-h-screen bg-neutral-950 p-6 font-sans text-neutral-100"
          : "bg-neutral-950 p-3 font-sans text-neutral-100"
      }
    >
      <GlowBorder active={recording}>
        <div className={standalone ? "mx-auto flex max-w-2xl flex-col" : "flex flex-col"}>
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-sm font-semibold tracking-tight">AI Note Tracker</span>
            <RecordButton
              onSessionStarted={() => {
                setRecording(true);
                refresh();
              }}
              onSessionStopped={() => {
                setRecording(false);
                refresh();
              }}
            />
          </div>

          <AnimatePresence mode="wait">
            {selected ? (
              <SessionDetail
                key="detail"
                session={selected}
                standalone={standalone}
                onBack={() => setSelected(null)}
                onDeleted={() => {
                  setSelected(null);
                  refresh();
                }}
              />
            ) : (
              <SessionList key="list" sessions={sessions} onSelect={setSelected} />
            )}
          </AnimatePresence>

          <div className="border-t border-white/5 px-4 py-2 text-center">
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="text-[11px] text-neutral-500 transition-colors hover:text-indigo-400"
            >
              Settings
            </button>
          </div>
        </div>
      </GlowBorder>
    </div>
  );
}
