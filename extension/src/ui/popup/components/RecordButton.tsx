import { useEffect, useState } from "preact/hooks";
import { motion } from "framer-motion";
import { send, getActiveTabId } from "@/ui/shared/messaging";
import { cn } from "@/ui/shared/cn";

interface Props {
  onSessionStarted?: () => void;
  onSessionStopped?: () => void;
}

export function RecordButton({ onSessionStarted, onSessionStopped }: Props) {
  const [tabId, setTabId] = useState<number>();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const id = await getActiveTabId();
      setTabId(id);
      if (id == null) {
        setBusy(false);
        return;
      }
      const state = await send<{ type: "recording-state"; recording: boolean }>({
        type: "get-recording-state",
        tabId: id,
      });
      setRecording(!!state?.recording);
      setBusy(false);
    })();
  }, []);

  async function toggle() {
    if (tabId == null) return;
    setBusy(true);
    if (recording) {
      await send({ type: "stop-recording", tabId });
      setRecording(false);
      onSessionStopped?.();
    } else {
      await send({ type: "start-recording", tabId });
      setRecording(true);
      onSessionStarted?.();
    }
    setBusy(false);
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      disabled={busy || tabId == null}
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50",
        recording ? "bg-neutral-700 hover:bg-neutral-600" : "bg-red-600 hover:bg-red-500",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full bg-white",
          recording && "animate-pulse-glow bg-red-300",
        )}
      />
      {recording ? "Stop" : "Record"}
    </motion.button>
  );
}
