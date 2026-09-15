import { useState } from "preact/hooks";
import { motion } from "framer-motion";
import type { NoteSession } from "@/types/session";
import { deleteSession, regenerateNote } from "@/ui/shared/messaging";

interface Props {
  session: NoteSession;
  onBack: () => void;
  onDeleted: () => void;
}

export function SessionDetail({ session, onBack, onDeleted }: Props) {
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="max-h-96 overflow-y-auto px-4 py-3"
    >
      <button onClick={onBack} className="mb-2 text-xs font-medium text-indigo-400 hover:text-indigo-300">
        ← Back
      </button>
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

      <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs leading-relaxed text-neutral-300">
        {session.generatedNote?.markdown ?? "Note not generated yet."}
      </pre>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          {regenerating ? "Generating…" : "Regenerate note"}
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
