import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { motion } from "framer-motion";
import type { GenerationLogEntry, NoteSession } from "@/types/session";
import { deleteSession, regenerateNote } from "@/ui/shared/messaging";
import { downloadText, transcriptToText } from "@/ui/shared/download";

interface Props {
  session: NoteSession;
  onBack: () => void;
  onDeleted: () => void;
  standalone?: boolean;
}

type Tab = "note" | "transcript" | "logs";

export function SessionDetail({ session, onBack, onDeleted, standalone = false }: Props) {
  const [regenerating, setRegenerating] = useState(false);
  const [tab, setTab] = useState<Tab>(session.generatedNote ? "note" : "transcript");
  const [liveLogs, setLiveLogs] = useState<GenerationLogEntry[]>(session.generationLogs ?? []);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Stream "ai-log" events for this session while it's regenerating; the
  // final log set also arrives persisted on session.generationLogs once the
  // background broadcasts session-updated on completion.
  useEffect(() => {
    setLiveLogs(session.generationLogs ?? []);
    const listener = (message: any) => {
      if (message?.type === "ai-log" && message.sessionId === session.id) {
        setLiveLogs((prev) => [...prev, message.entry as GenerationLogEntry]);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    if (tab === "logs") {
      logsEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [liveLogs, tab]);

  async function handleRegenerate() {
    setRegenerating(true);
    setLiveLogs([]);
    setTab("logs");
    try {
      await regenerateNote(session.id);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    await deleteSession(session.id);
    onDeleted();
  }

  function handleOpenFullView() {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`src/ui/popup/index.html?sessionId=${session.id}&view=tab`),
    });
  }

  function handleExportTranscript() {
    downloadText(`${sanitizeFilename(session.title)}-transcript.txt`, transcriptToText(session));
  }

  function handleExportNote() {
    if (!session.generatedNote) return;
    downloadText(`${sanitizeFilename(session.title)}-note.md`, session.generatedNote.markdown, "text/markdown");
  }

  const bodyMaxHeight = standalone ? "" : "max-h-96";

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className={`${bodyMaxHeight} overflow-y-auto px-4 py-3`}
    >
      <div className="mb-2 flex items-center justify-between">
        <button onClick={onBack} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
          ← Back
        </button>
        {!standalone && (
          <button
            onClick={handleOpenFullView}
            className="text-[11px] font-medium text-neutral-500 transition-colors hover:text-indigo-400"
            title="Open this session in a full browser tab"
          >
            Open full view ↗
          </button>
        )}
      </div>

      <h2 className="text-sm font-semibold text-neutral-100">
        {session.title || "Untitled session"}
      </h2>
      <div className="mb-3 mt-0.5 text-[11px] text-neutral-500">
        {new Date(session.createdAt).toLocaleString()} · {session.status}
      </div>

      {session.screenshots.length > 0 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto">
          {session.screenshots.map((shot) => (
            <img
              key={shot.id}
              src={shot.dataUrl}
              alt="screenshot"
              className="h-14 shrink-0 rounded-md border border-white/10"
            />
          ))}
        </div>
      )}

      <div className="mb-2 flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
        <TabButton active={tab === "note"} onClick={() => setTab("note")}>
          Note
        </TabButton>
        <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")}>
          Transcript ({session.transcript.length})
        </TabButton>
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>
          Logs {liveLogs.length > 0 ? `(${liveLogs.length})` : ""}
        </TabButton>
      </div>

      {tab === "note" && (
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs leading-relaxed text-neutral-300">
          {session.generatedNote?.markdown ?? "Note not generated yet — check the Transcript tab, or click Regenerate note below."}
        </pre>
      )}

      {tab === "transcript" && (
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs leading-relaxed text-neutral-300">
          {session.transcript.length === 0 ? (
            <p className="text-neutral-500">No transcript captured yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {session.transcript.map((entry, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 tabular-nums text-neutral-600">
                    {new Date(entry.timestampMs).toLocaleTimeString()}
                  </span>
                  <span>{entry.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "logs" && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
          {liveLogs.length === 0 ? (
            <p className="text-neutral-600">
              No generation logs yet — click "Regenerate note" to see live AI provider activity here
              (which provider is called, responses, fallbacks on failure).
            </p>
          ) : (
            <>
              {liveLogs.map((entry, i) => (
                <div key={i} className={`flex gap-2 ${logLevelClass(entry.level)}`}>
                  <span className="shrink-0 tabular-nums text-neutral-600">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="break-words">{entry.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          {regenerating ? "Generating…" : "Regenerate note"}
        </button>
        <button
          onClick={handleExportTranscript}
          disabled={session.transcript.length === 0}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          Export transcript
        </button>
        <button
          onClick={handleExportNote}
          disabled={!session.generatedNote}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          Export note
        </button>
        <button
          onClick={handleDelete}
          className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ComponentChildren }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        active ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

function sanitizeFilename(name: string): string {
  return (name || "session").replace(/[^a-z0-9\-_]+/gi, "-").slice(0, 60);
}

function logLevelClass(level: GenerationLogEntry["level"]): string {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-amber-400";
    default:
      return "text-neutral-300";
  }
}
