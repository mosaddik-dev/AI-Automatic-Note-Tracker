import type { NoteSession } from "@/types/session";

interface Props {
  session: NoteSession;
  onJumpToEntry: (entryIndex: number) => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * A video-scrubber-style timeline of the recording: a horizontal bar spanning
 * from the first to the last transcript entry, with screenshot thumbnails
 * plotted at their actual captured position and speech-density ticks for
 * transcript entries. Clicking a marker jumps to that point in the
 * Transcript tab (there's no literal video element to seek — this is the
 * recorded tab's audio/transcript, not a video the extension controls — so
 * "jump" means scroll-to-position in the transcript, not video playback).
 */
export function SessionTimeline({ session, onJumpToEntry }: Props) {
  const { transcript, screenshots } = session;

  if (transcript.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4 text-center text-xs text-neutral-500">
        No transcript captured yet — the timeline fills in once recording starts producing text.
      </div>
    );
  }

  const startMs = transcript[0].timestampMs;
  const endMs = Math.max(transcript[transcript.length - 1].timestampMs, ...screenshots.map((s) => s.timestampMs));
  const durationMs = Math.max(endMs - startMs, 1);
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - startMs) / durationMs) * 100));

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] text-neutral-500">
        <span>0:00</span>
        <span>{formatElapsed(durationMs)} total</span>
      </div>

      {/* Screenshot thumbnails row, positioned above the bar at their proportional time. */}
      {screenshots.length > 0 && (
        <div className="relative mb-1 h-10">
          {screenshots.map((shot) => (
            <button
              key={shot.id}
              type="button"
              title={`Screenshot at ${formatElapsed(shot.timestampMs - startMs)}`}
              onClick={() => onJumpToEntry(shot.associatedTranscriptIndex ?? 0)}
              className="absolute top-0 w-8 -translate-x-1/2 overflow-hidden rounded border border-white/10 transition-transform hover:z-10 hover:scale-150"
              style={{ left: `${pct(shot.timestampMs)}%` }}
            >
              <img src={shot.dataUrl} alt="" className="h-8 w-8 object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* The scrubber bar itself, with a tick per transcript entry (denser = more speech). */}
      <div className="relative h-2 rounded-full bg-white/5">
        {transcript.map((entry, i) => (
          <button
            key={i}
            type="button"
            title={`${formatElapsed(entry.timestampMs - startMs)} — ${entry.text.slice(0, 60)}`}
            onClick={() => onJumpToEntry(i)}
            className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/60 transition-colors hover:bg-indigo-300"
            style={{ left: `${pct(entry.timestampMs)}%` }}
          />
        ))}
      </div>

      <p className="mt-2 text-[10px] text-neutral-600">
        {transcript.length} transcript entries · {screenshots.length} screenshot
        {screenshots.length === 1 ? "" : "s"} — click a mark or thumbnail to jump to that point in the transcript.
      </p>
    </div>
  );
}
