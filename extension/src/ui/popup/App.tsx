import { useEffect, useState, useCallback } from "preact/hooks";
import { AnimatePresence } from "framer-motion";
import type { NoteSession } from "@/types/session";
import { listSessions } from "@/ui/shared/messaging";
import { GlowBorder } from "@/ui/shared/GlowBorder";
import { RecordButton } from "./components/RecordButton";
import { SessionList } from "./components/SessionList";
import { SessionDetail } from "./components/SessionDetail";

export function App() {
  const [sessions, setSessions] = useState<NoteSession[]>([]);
  const [selected, setSelected] = useState<NoteSession | null>(null);
  const [recording, setRecording] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listSessions();
    setSessions(list);
    setSelected((prev) => (prev ? list.find((s) => s.id === prev.id) ?? null : prev));
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

  return (
    <div className="bg-neutral-950 p-3 font-sans text-neutral-100">
      <GlowBorder active={recording}>
        <div className="flex flex-col">
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
