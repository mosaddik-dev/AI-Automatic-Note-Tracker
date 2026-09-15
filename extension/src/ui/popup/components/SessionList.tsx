import { motion } from "framer-motion";
import type { NoteSession } from "@/types/session";

interface Props {
  sessions: NoteSession[];
  onSelect: (session: NoteSession) => void;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function preview(session: NoteSession): string {
  if (session.generatedNote?.markdown) return session.generatedNote.markdown.slice(0, 90);
  const last = session.transcript[session.transcript.length - 1];
  return last?.text?.slice(0, 90) ?? "No transcript yet";
}

const STATUS_DOT: Record<NoteSession["status"], string> = {
  recording: "bg-red-400",
  stopped: "bg-neutral-500",
  processing: "bg-amber-400",
  completed: "bg-emerald-400",
};

export function SessionList({ sessions, onSelect }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-neutral-500">
        No sessions yet. Press Record to start.
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="max-h-96 space-y-1.5 overflow-y-auto px-2 py-2">
      {sorted.map((session, i) => (
        <motion.button
          key={session.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 6) * 0.03, duration: 0.2 }}
          whileHover={{ scale: 1.01 }}
          onClick={() => onSelect(session)}
          className="w-full rounded-lg border border-white/5 bg-white/[0.03] p-3 text-left transition-colors hover:border-white/10 hover:bg-white/[0.06]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-neutral-100">
              {session.title || "Untitled session"}
            </span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[session.status]}`} />
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            {formatDate(session.updatedAt)} · {session.status}
          </div>
          <div className="mt-1 truncate text-xs text-neutral-400">{preview(session)}</div>
        </motion.button>
      ))}
    </div>
  );
}
