import type { TranscriptEntry } from "../types/session";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  /** "asr" = auto-generated; absent/other = manually created/uploaded. */
  kind?: string;
}

export function isYouTubeWatchUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === "/watch" && u.searchParams.has("v");
  } catch {
    return false;
  }
}

/**
 * Reads the caption track list YouTube embeds in the watch page itself
 * (`ytInitialPlayerResponse`, a page global — not a documented/stable API,
 * but the same data YouTube's own player UI reads, so it's about as
 * reliable as anything unofficial can be). Runs in the page's own JS world
 * via chrome.scripting (content scripts run in an isolated world and can't
 * see page globals directly).
 */
async function getCaptionTracks(tabId: number): Promise<CaptionTrack[] | null> {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        try {
          const tracks = (window as any).ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer
            ?.captionTracks;
          if (!Array.isArray(tracks)) return null;
          return tracks.map((t: any) => ({
            baseUrl: t.baseUrl as string,
            languageCode: t.languageCode as string,
            kind: t.kind as string | undefined,
          }));
        } catch {
          return null;
        }
      },
    });
    return (result as CaptionTrack[] | null) ?? null;
  } catch {
    return null;
  }
}

/** Prefers Bengali, then a manually-created (non-"asr") track, over auto-generated captions in any other language. */
function pickBestTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const score = (t: CaptionTrack) => (t.languageCode?.startsWith("bn") ? 2 : 0) + (t.kind !== "asr" ? 1 : 0);
  return [...tracks].sort((a, b) => score(b) - score(a))[0];
}

interface TimedTextJson3 {
  events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>;
}

async function fetchTrackEntries(track: CaptionTrack): Promise<TranscriptEntry[]> {
  const res = await fetch(`${track.baseUrl}&fmt=json3`);
  if (!res.ok) {
    throw new Error(`timedtext fetch failed (${res.status})`);
  }
  const json: TimedTextJson3 = await res.json();
  const entries: TranscriptEntry[] = [];
  for (const event of json.events ?? []) {
    const text = (event.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\n/g, " ")
      .trim();
    if (!text) continue;
    entries.push({ text, timestampMs: event.tStartMs ?? 0 });
  }
  return entries;
}

/**
 * Fetches YouTube's own caption track for the tab's video, if the tab is a
 * YouTube watch page and any caption track exists. Returns null (not an
 * error) when unavailable — this is a best-effort supplement to the local
 * audio+STT transcript, not a required step.
 */
export async function tryFetchYouTubeTranscript(tabId: number): Promise<TranscriptEntry[] | null> {
  const tracks = await getCaptionTracks(tabId);
  if (!tracks || tracks.length === 0) return null;

  const track = pickBestTrack(tracks);
  if (!track) return null;

  try {
    const entries = await fetchTrackEntries(track);
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}
