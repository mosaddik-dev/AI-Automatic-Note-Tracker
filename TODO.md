# AI Automatic Note Tracker — Progress Tracker

> Read this file first in any new session to know exactly where things stand.
> Update it after every meaningful step (don't wait until "done").

## Current Phase
**Phase 0 — DONE.** Now in Phase 1-ish territory: reconciling the 3 parallel agents' work
(extension foundation, AI providers, UI) into a buildable whole. See "reconciliation checklist"
near the bottom.

## Status: Phase 0 (model extraction) COMPLETE and committed (`84b5667`). Extension scaffolding
(background, AI providers, storage, UI) built in parallel by 3 agents — reconciliation pass next.

---

## Findings from inspecting `stt-engine/` (source app "Bolo")

- `stt-engine/` is a Rust workspace (`bolo-core`, `bolo`, `bolo-gui`) — a native Linux desktop
  app (global hotkey, ALSA mic capture, tray, egui settings, clipboard/typing output).
  **None of this Rust/ALSA/egui/tray code is portable to a Chrome extension and must NOT be copied.**
- The actual model: `sherpa-onnx-streaming-zipformer-bn-vosk-2026-02-09/`
  - `encoder.onnx` (~91MB), `decoder.onnx` (~2MB), `joiner.onnx` (~1MB), `tokens.txt`
  - Also present but NOT needed for inference: `bpe.model`, `unigram_500.vocab`, `test_wavs/`, `README.md`
  - Model type used by the app: `zipformer2` transducer (streaming), decoding method `greedy_search`,
    sample_rate 16000 (see `bolo-core/src/asr.rs::build_recognizer`).
  - Source: https://huggingface.co/alphacep/vosk-model-small-streaming-bn (per model README).
- Runtime the app uses: `sherpa-onnx` Rust bindings (vendored at `vendor/sherpa-onnx-rust`) →
  native C++ `sherpa-onnx` core + `onnxruntime` (`.so`/`.a` files in `stt-engine/lib/`).
  **This native runtime cannot run inside a browser/extension as-is.**

## Architecture decision (per prompt.md "STOP and investigate" rule)

The model files (ONNX + tokens) are 100% portable — they're just data. The blocker is the
**runtime**: it's a native Rust/C++ binary using ALSA, not something a Manifest V3 extension
(service worker + content scripts, no native code, no ALSA) can execute.

**Chosen path:** Build sherpa-onnx's own **official WebAssembly build** (`build-wasm-simd-asr.sh`
from the k2-fsa/sherpa-onnx upstream repo) with our exact model baked in via its `wasm/asr/assets/`
mechanism. This reuses the *real* sherpa-onnx inference engine (feature extraction, zipformer2
transducer, greedy search) compiled to WASM — not a reimplementation — satisfying "preserve model
integrity" and "do not create a fake browser implementation."

Why not alternatives:
- Reimplementing fbank + zipformer2 streaming decode by hand in JS/onnxruntime-web: high risk of
  subtly wrong results, violates "do not rewrite the model unnecessarily."
- Node-only `sherpa-onnx` npm addon: native binding, cannot run in a browser extension's service worker.

Build requirements: emscripten SDK. `emcc` is NOT installed on this machine. Tried Docker
(`emscripten/emsdk` image) first but `docker pull` fails with "permission denied" — user is not in
the `docker` group and passwordless `sudo` isn't available in this session. **Switched to installing
emsdk natively** (`git clone emscripten-core/emsdk` → `./emsdk install/activate 4.0.23`, no root
needed, self-contained under `/tmp/emsdk`). This is a **large, long-running build** (compiles
onnxruntime + sherpa-onnx core to wasm) — expect it to take a while; run in background and poll.

If the user wants to unblock Docker instead at some point: `sudo usermod -aG docker $USER` then
re-login (or open a new shell with `newgrp docker`).

## Plan (Phase 0 sub-steps)

- [x] Inspect `stt-engine/` app structure, identify model vs. app code
- [x] Identify model files, model type (zipformer2 transducer), decoding config
- [x] Decide extraction/runtime architecture (sherpa-onnx official WASM build via native emsdk)
- [x] Clone upstream `k2-fsa/sherpa-onnx` → `/tmp/sherpa-onnx-upstream` (shallow clone, for wasm
      build scripts + C++ core — the vendored copy in `stt-engine/vendor/` only has Rust glue)
- [x] Copy our model files into `/tmp/sherpa-onnx-upstream/wasm/asr/assets/`
      (encoder.onnx, decoder.onnx, joiner.onnx, tokens.txt) — confirmed the JS default config
      (sampleRate 16000, greedy_search, rule1=2.4/rule2=1.2/rule3=20) already matches what the
      original Rust app used, so **no config edits needed**, only asset files.
- [ ] Install emscripten 4.0.23 natively (no docker — docker required root, blocked; see below).
      Cloned `/tmp/emsdk`, running `./emsdk install 4.0.23` in background (task id `bnt8h0spy`
      as of this writing — check with Bash output file / TaskOutput if resuming and unsure of state).
      Next after install finishes: `./emsdk activate 4.0.23 && source ./emsdk_env.sh`
- [ ] Run `./build-wasm-simd-asr.sh` from `/tmp/sherpa-onnx-upstream` (with emsdk env sourced) →
      produces `build-wasm-simd-asr/install/bin/wasm/asr/sherpa-onnx-wasm-main-asr.{js,wasm,data}`
      (exact output path TBD — verify once build completes, check `install/bin` or similar)
- [ ] Copy build output into extension project at
      `extension/src/services/transcription/runtime/`
- [ ] Create clean module `extension/src/services/transcription/LocalBengaliSTT.ts` implementing
      a `TranscriptionProvider` interface, wrapping the wasm module
- [ ] Verify: load the wasm module standalone (plain HTML test page or Node w/ wasm),
      feed `test_wavs/0.wav` / `1.wav` from the model folder, confirm Bengali text output
      matches what the original Rust app would produce
- [x] WASM build succeeded (was interrupted once by a stray duplicate process I killed by
      accident via an over-broad `pkill`; cleaned up and reran once, cleanly). Output:
      `sherpa-onnx-wasm-main-asr.{js,wasm,data}` + `sherpa-onnx-asr.js` helper — moved into
      `extension/public/transcription-runtime/` (NOT `src/`, so Vite copies them verbatim as
      static assets instead of trying to bundle/transform them).
- [x] Wrote `extension/src/services/transcription/LocalBengaliSTT.ts` implementing
      `TranscriptionProvider`: dynamically injects the two runtime `<script>` tags (classic
      Emscripten glue, not ES modules — needs a global `Module` object set up before load),
      waits for `onRuntimeInitialized`, then wraps `createOnlineRecognizer`/`OnlineStream`.
      Wired into `createTranscriptionProvider.ts` (replacing the stub Agent 1 built as a
      placeholder — that's still in the codebase as `StubTranscriptionProvider.ts` in case it's
      useful for UI dev/testing without the ~103MB runtime loaded, just no longer used by default).
      Confirmed the WASM build's built-in default config already matches the original Rust app
      exactly (transducer type, 16kHz, greedy_search, rule1/2/3) — passed no custom config.
- [x] Verified standalone (NOT yet inside the actual extension/offscreen doc — that still needs a
      real from-inside-Chrome smoke test once `npm install` + `npm run build` + manual load-unpacked
      is done, see reconciliation checklist): served the runtime + `test_wavs/0.wav`/`1.wav` from
      the model folder over a local `python3 -m http.server`, loaded in a headless Chrome via
      Playwright, fed raw PCM samples through the same accept/decode loop as `LocalBengaliSTT.ts`.
      **Both produced coherent, correct Bengali text** — 1.wav in particular is a well-known
      Bengali translation of the JFK "ask not what your country can do for you" line, transcribed
      essentially perfectly, which is strong evidence the extracted model behaves identically to
      the original Rust app. Verification scratch files are in the session scratchpad
      (`wasm-verify/`), not part of the repo.
- [x] First git commit made: `84b5667` — `feat: integrate local Bengali speech-to-text model`.
      Scoped to only: `.gitignore`, `prompt.md`, `TODO.md`, `extension/manifest.config.ts`,
      `extension/src/types/transcription.ts`, `extension/src/services/transcription/**`,
      `extension/public/transcription-runtime/**`. Deliberately did NOT include
      `background/`, `ai/`, `storage/`, `ui/`, `screenshot/`, or shared build config
      (`package.json`/`tsconfig.json`/`vite.config.ts`/tailwind) — those are a separate,
      not-yet-committed body of work from the 3 parallel agents (see below), to be committed
      separately once reconciled. `stt-engine/` itself is gitignored (has its own nested `.git`,
      not meant to be part of this repo).

## Scaffolding done (parallel to STT build)

Created `extension/` project skeleton to unblock parallel work while the WASM build runs:
- `extension/package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.config.ts`
  (Vite + `@crxjs/vite-plugin` + Preact + TypeScript, Manifest V3)
- Shared type contracts (do NOT change signatures without updating all consumers):
  - `extension/src/types/transcription.ts` — `TranscriptionProvider`, `AudioChunk`, `TranscriptSegment`
  - `extension/src/types/ai.ts` — `AIProvider`, `AIProviderConfig`, `GeneratedNote`, `NoteGenerationInput`
  - `extension/src/types/session.ts` — `NoteSession`, `TranscriptEntry`, `ScreenshotEntry`
- Empty dirs reserved: `src/background/`, `src/content/`, `src/services/{transcription,storage,ai,screenshot}/`,
  `src/ui/{popup,options}/`
- **`npm install` has NOT been run yet** — no `node_modules/`, so nothing has been typechecked/built yet.
  Do that before trusting any code compiles.

Dispatched 3 parallel background agents (per user's request to speed up given the size of this
project) to build independent workstreams while STT/WASM work continues on the main thread:
- **Agent 1 (extension-foundation)**: `src/background/`, `src/content/`, `src/services/storage/`,
  `src/services/transcription/offscreen.html` + pipeline wiring — tab audio capture via offscreen
  document + `chrome.tabCapture`, session management, persistent storage. Uses a **stub**
  `TranscriptionProvider` for now (real WASM model not ready yet) — must be swappable.
- **Agent 2 (ai-providers)**: `src/services/ai/` — provider abstraction, Google/Groq/OpenRouter
  providers, automatic fallback chain, AI note generation, Notion-ready markdown output.
- **Agent 3 (ui-dashboard)**: `src/ui/popup/`, `src/ui/options/`, `src/services/screenshot/` —
  dashboard/session history popup, settings page, intelligent screenshot capture (frame-diff based)
  + association with transcript timestamps.

All three were told **not** to edit `package.json`/`tsconfig.json`/`vite.config.ts`/`manifest.config.ts`
directly — instead report back any new npm dependency they need, and it gets added centrally
(here, or by whoever picks this up) to avoid concurrent-edit conflicts. **Check their final reports
for a "needs these deps" list and reconcile `package.json` before running `npm install`.**

If resuming this session and unsure whether these finished: check `ListAgents` / task notifications,
or just inspect whether `src/background/index.ts` etc. have real content vs. empty dirs.

### Agent 1 (extension-foundation) — DONE
Created: `src/background/{messages.ts,offscreenManager.ts,index.ts}`,
`src/services/transcription/{StubTranscriptionProvider.ts,createTranscriptionProvider.ts,pipeline.ts,offscreen.html,offscreen.ts}`,
`src/services/storage/{db.ts,index.ts}` (hand-rolled IndexedDB, no `idb` dep needed),
`src/content/index.ts`. No new deps needed.
Flagged (and now fixed): `vite.config.ts` was missing the `@/*` alias that `tsconfig.json` declares
— **fixed**, see `resolve.alias` in `extension/vite.config.ts`.
**Still TODO when the real STT model is ready:** swap `StubTranscriptionProvider` for the real
sherpa-onnx-WASM-backed provider inside `src/services/transcription/createTranscriptionProvider.ts`
(that's the one file to change — it's a factory function by design).

### Agent 2 (ai-providers) — DONE
Created: `src/services/ai/{prompts.ts,notion.ts,logger.ts,registry.ts,fallback.ts,index.ts}`,
`src/services/ai/providers/{GoogleProvider.ts,openAiCompatible.ts,GroqProvider.ts,OpenRouterProvider.ts}`.
No new deps needed — plain `fetch()` against each provider's REST API (Node SDKs avoided on purpose,
this runs in an extension service worker). API request/response shapes are **assumed, not yet
verified against live docs** — verify before shipping:
- Google: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- Groq/OpenRouter (OpenAI-compatible): `POST .../chat/completions`, `Authorization: Bearer {apiKey}`

### Agent 3 (ui-dashboard) — DONE, including Aceternity-style restyle
User asked for a visually polished UI based on https://ui.aceternity.com/ (Tailwind + Framer Motion
component patterns). Shared config for this was added **by me** (main thread): `tailwindcss`/
`autoprefixer`/`postcss` + `framer-motion`/`clsx`/`tailwind-merge` in `package.json`,
`tailwind.config.js`, `postcss.config.js`, `src/ui/globals.css`, and `preact/compat` React aliases
in `vite.config.ts` so `framer-motion` (React-targeting) works with our Preact setup.

Agent 3 finished the original dashboard/settings/screenshot work AND the restyle. Added:
- `src/ui/shared/cn.ts` (clsx+tailwind-merge helper), `src/ui/shared/GlowBorder.tsx` (rotating
  conic-gradient animated border, glows brighter while recording), `src/ui/shared/SpotlightCard.tsx`
  (mouse-follow radial spotlight card)
- Popup: dark theme, pulsing-glow record button, staggered-entrance animated session cards,
  slide-in session detail view
- Options: gradient-text heading, spotlight cards for provider config + screenshot settings, sticky
  save bar with animated confirmation
- Removed old plain-CSS files (`popup.css`, `options.css`) — everything is Tailwind now
- **One additive shared-config edit the agent made itself** (flagged, told to avoid shared config
  but needed for the animations): added `spin-slow` and `pulse-glow` keyframes/animations to
  `tailwind.config.js`'s `theme.extend` only — didn't touch `content`/`plugins`. Acceptable, low risk.
- Confirm before trusting: whether `popup/main.tsx`/`options/main.tsx` actually `import` the
  `globals.css` file (agent said config was verified to exist, but explicit import wasn't
  double-confirmed in its report) — check this in the reconciliation pass below.

### After all agents finish: reconciliation checklist — DONE (this pass)
- [x] `src/ui/popup/main.tsx` and `src/ui/options/main.tsx` both `import "@/ui/globals.css"` — confirmed
      (I wrote both of these myself while acting as the Agent 3 fork).
- [x] Storage function names match exactly: `listSessions`, `getSession`, `deleteSession`,
      `createEmptySession`, `saveSession`, `appendTranscriptEntry`, `addScreenshot` all exist in
      `src/services/storage/db.ts` (re-exported via `index.ts`) with the signatures the UI assumed.
      No mismatch — nothing to fix.
- [x] `capture-visible-tab`/`capture-visible-tab-response` (screenshot service) and
      `get-ai-provider-configs`/`set-ai-provider-configs` (options page) messages are still **not**
      wired into `background/index.ts` — but turns out **nothing currently calls them**: the options
      page reads/writes `chrome.storage.local` directly (not via messages), and the screenshot
      service/intelligent-capture pipeline isn't hooked into the recording flow yet. Not a bug to fix
      now — it's genuinely unbuilt functionality, tracked under Phases 14–15 below (screenshot capture
      isn't wired into `startRecording`/content script yet).
- [x] Ran `cd extension && npm install` (128 packages) — clean, only routine `esbuild` postinstall-script
      + audit warnings, nothing blocking.
- [x] `npx tsc -b --noEmit` — found and fixed 2 real errors in `src/background/index.ts`:
      `chrome.tabCapture.getMediaStreamId` is callback-only in `@types/chrome` (not promise-based
      despite MV3 docs suggesting otherwise) — wrapped in a `new Promise(...)`. Whole project now
      typechecks clean.
- [x] Wired up `regenerate-note` end-to-end (was previously a UI-only stub message with no handler):
      added to `RuntimeMessage` union in `messages.ts`, handler in `background/index.ts` calls
      `generateNoteWithFallback` (from `services/ai`) using configs read from
      `chrome.storage.local[STORAGE_KEY_AI_PROVIDER_CONFIGS]`, saves the result onto the session, and
      broadcasts `session-updated` (processing → completed/failed). Also now auto-triggers note
      generation when recording stops (if there's any transcript) — previously nothing generated a
      note automatically, only the manual "Regenerate note" button existed.
- [x] Screenshot capture is now wired (done after this checklist was written, by main thread):
      `startRecording` in `background/index.ts` creates one `IntelligentScreenshotCapture` per
      active recording and a `setInterval` (period = `screenshotSettings.minIntervalMs`, min 1s)
      that calls `chrome.tabs.captureVisibleTab`, feeds the result through `.maybeAccept()`, and on
      acceptance calls `associateScreenshotWithTranscript` + `addScreenshot` + broadcasts
      `session-updated`. Cleared via `clearInterval` in `stopRecording`. **Real limitation, not a
      bug**: `chrome.tabs.captureVisibleTab` can only capture whichever tab is currently
      foregrounded in its window — there's no Chrome API to screenshot a specific *background* tab
      — so the tick skips (no-op) whenever the recorded tab isn't `tab.active`. Settings read from
      `chrome.storage.local[STORAGE_KEY_SCREENSHOT_SETTINGS]` (same key the options page writes).
- [ ] AI provider request/response shapes in `services/ai/providers/*` are assumed, not verified
      against live API docs (see Agent 2 section above) — verify before relying on real API calls.
- [x] `npm run build` (full production build, not just typecheck) — succeeded after adding
      placeholder `public/icons/icon{16,48,128}.png` (build was failing on their absence; these are
      **placeholder art** — a simple generated mic/waveform glyph, not real branding, swap before
      shipping). Output `manifest.json`/bundle structure looks like a valid loadable MV3 extension;
      `public/transcription-runtime/*` copied verbatim into `dist/transcription-runtime/` as
      expected. Only build noise: harmless "use client" directive warnings from `framer-motion`
      (expected outside Next.js, safe to ignore).
- [x] **Second git commit made**: everything from the 3 agents + the screenshot wiring + icons, as
      one "extension foundation" commit (background, ai, storage, screenshot, ui, shared build
      config). Kept separate from the Phase-0 model-extraction commit per prompt.md's instructions.

### NOT yet done — do this before trusting the extension actually works end-to-end
**No real in-browser smoke test has been run this session** — only `npm run build` (proves valid
MV3 structure) and the earlier standalone Playwright test of the raw WASM model (proves the model
itself is correct). Next session/step should be:
```
cd extension && npm run build
# Chrome/Brave → chrome://extensions → enable Developer mode → Load unpacked → select extension/dist
```
Then actually click record on a tab playing Bengali audio, confirm: transcript segments appear,
a screenshot gets captured on a visual change (while the tab stays focused), stopping recording
auto-generates a note (or fails clearly if no real AI provider API key is configured yet — expected,
since none has been entered anywhere).

## Roadmap (Phases 1–21 from prompt.md) — status

1. Local STT model integration — **done** (Phase 0 above)
2. Manifest V3 extension foundation — **done**
3. Tab audio capture — **done** (offscreen doc + `chrome.tabCapture`)
4. Audio → local STT pipeline — **done**
5. Transcript session management — **done**
6. Persistent storage — **done** (IndexedDB)
7. AI provider abstraction — **done** (interface + fallback chain)
8. Google provider — **done**; hit live-API breakage: default model `gemini-1.5-flash` was retired
   (404 "not found for API version v1beta"). Updated default to `gemini-2.5-flash` (per
   RECOMMENDED_MODELS in `src/ui/shared/storageKeys.ts`).
9. Groq provider — **done**; hit live-API breakage: default model `llama-3.1-70b-versatile` was
   decommissioned by Groq (~2026-08). Updated default to `openai/gpt-oss-20b`.
10. OpenRouter provider — **done**; `openrouter/auto` untouched, not affected.
    - Since defaults only apply on a fresh install (a user's already-saved `chrome.storage.local`
      config keeps its old model string forever otherwise), also added a live "outdated model"
      hint + "Use recommended" one-click reset button + model-list doc link to each provider row
      in the Options page (`src/ui/options/components/ProviderConfigRow.tsx`), driven by the same
      `RECOMMENDED_MODELS` map — so this class of breakage is at least visible and fixable in the UI
      next time a provider retires a model, without needing another code change to notice it.
    - **This will keep happening** — providers retire model names outright with no warning, not on
      a predictable schedule. `RECOMMENDED_MODELS` in `src/ui/shared/storageKeys.ts` is the one
      place to update when it does; no other code changes needed.
    - **Round 2** (same day): `gemini-2.5-flash` was ALSO cut off from new users within the same
      session — Google's own 404 response named the replacement (`gemini-3.6-flash`), so updated
      to that. Separately, real production error surfaced a wrong assumption in the chunking work
      below: Groq rejected a 9000-char chunk with "Requested 31081... Limit 8000" (tokens per
      minute) — Bengali text tokenizes far more densely than English (~3.4 tokens/char observed
      here, not the ~4 chars/token this session originally assumed). Fixed
      `DEFAULT_CHUNK_CHAR_BUDGET` down from 9000 → **1600** chars (`services/ai/chunking.ts`),
      sized conservatively against Groq's tight on_demand free-tier cap (the tightest limit
      actually hit) rather than against providers with much larger context windows.
    - **Known remaining limitation, not fixed**: Groq's 8000-TPM cap is PER MINUTE across ALL
      requests, not per-request — firing several small chunk requests back-to-back could still
      cumulatively exceed it within the same minute even though each individual request now stays
      well under budget. No inter-chunk throttling/delay was added (judged over-engineering for
      this pass) — the existing provider-fallback chain is the safety net if that happens (as it
      already did correctly in the reported error: google → groq → openrouter). If Groq keeps
      showing up as failed in the Logs tab for multi-part generations, that's why.
11. Automatic fallback system — **done**
12. AI note generation — **done** (wired to auto-trigger on stop + manual regenerate button).
    Extended for long recordings (user request: "video is very long... limit may be exceeded"):
    - `services/ai/chunking.ts` — splits `TranscriptEntry[]` into character-budgeted chunks
      (`DEFAULT_CHUNK_CHAR_BUDGET = 9000` chars/chunk, no tokenizer available so this is a
      conservative char-based proxy for token limits) without ever splitting a single entry's text
      across two chunks. `needsChunking()` gate — short transcripts are untouched, single request
      exactly as before. Verified with a standalone smoke test: full entry coverage, no gaps/overlap.
    - `services/ai/chunkedGeneration.ts` — `generateChunkedNote()` orchestrates multi-part
      generation: sends each chunk through the existing `generateNoteWithFallback` in order, gives
      each part (after the first) a short tail excerpt of the previous chunk's transcript text as
      `previousContext` purely for continuity (consistent terminology/language — instructed NOT to
      repeat/re-summarize it), filters `screenshotDescriptions` per chunk by
      `associatedTranscriptIndex` range (so a screenshot only shows up in the part it actually
      belongs to), then concatenates all parts' Markdown into the final note.
    - `services/ai/prompts.ts` — system prompt now has explicit "Part N of M" rules: part 1 writes
      the normal title/summary; part 2+ must NOT repeat title/summary, only continue with new
      `## Topic` sections, staying consistent with what came before.
    - Every chunking/sending/merging step logs through the **same live AI-logs feature** built
      earlier (`createCollectingLogger`) — e.g. "transcript is 31000 chars — splitting into 4
      parts", "sending part 2/4 to AI (8999 chars)…", "part 2/4 done via groq", "merging 4 parts
      into the final note" — satisfying the user's "I will also keep a log of the ones I send" ask
      with zero new UI work (the Logs tab already shows whatever the logger emits).
    - `background/index.ts`'s `regenerateNote()` now calls `generateChunkedNote` instead of calling
      `generateNoteWithFallback` directly; `buildScreenshotDescriptions()` now returns
      `{associatedTranscriptIndex, description}[]` instead of plain `string[]` so chunking can filter
      by index.
    - **Not yet tested against a real long transcript / real API** — only the pure chunking-math
      logic was smoke-tested standalone. Next verification step: record something long enough to
      trigger multi-part generation (>~9000 chars of transcript, roughly 20-30+ min depending on
      speech density) and confirm the Logs tab shows multiple parts and the final note reads
      coherently across the part boundary.
13. Notion-ready output — **done** (`markdownToNotionBlocks`, pragmatic subset of Markdown)
14. Intelligent screenshot detection — **done** (frame-diff based, see above); reviewed again after
    user asked "is screenshot working properly / positioned right" — found & fixed 2 real bugs:
    (a) `NoteGenerationInput.screenshotDescriptions` was wired into the AI prompt but never actually
    populated by `regenerateNote()`, so the AI never knew screenshots existed — fixed with
    `buildScreenshotDescriptions()` (timestamp + nearby transcript text; **no real image captioning
    exists** — that would need a vision-model API call per screenshot, out of scope for now);
    (b) screenshots displayed as a disconnected thumbnail strip at the top of the popup, unrelated
    to the transcript — fixed by inlining each screenshot into the Transcript tab right after its
    associated transcript entry. Known, accepted limitation: `chrome.tabs.captureVisibleTab` can
    only capture the foreground/active tab, so no screenshots happen while the user is tabbed away
    from the recording — this is a Chrome platform restriction, not a bug. No content-aware
    "technical topic" detection exists (only generic pixel-diff) — real scene classification was
    judged out of scope.
15. Screenshot storage/association — **done**
16. Dashboard/session history — **done** (popup UI)
17. Settings — **done** (options page: provider keys/priority, screenshot sensitivity). Extended
    per user request: model fields are now labeled dropdowns ("Fast"/"Normal"/"Best"/"Complex task"
    tags) with a "Custom…" free-text fallback, defined in `src/ui/shared/modelOptions.ts`
    (`MODEL_OPTIONS`) — researched current free-tier-friendly picks per provider (Google's free
    tier went Flash-only in April 2026; Groq's free/on_demand tier; OpenRouter's `:free`-suffixed
    models + `openrouter/auto` as the no-naming-risk default). Also added a **4th provider**,
    `custom` (`AIProviderId` now includes `"custom"`, `AIProviderConfig.endpoint?: string`) — a
    user-supplied OpenAI-compatible `/chat/completions` endpoint (model name + endpoint URL + API
    key, all user-entered), implemented via `providers/CustomOpenAiCompatibleProvider.ts` reusing
    the existing shared `generateNoteViaOpenAiCompatibleChat` helper, registered in `registry.ts`,
    and participating in the same priority/fallback chain as the other three — no changes needed to
    `fallback.ts` or `chunkedGeneration.ts` since they're already generic over `AIProviderConfig[]`.
    Options page merges newly-added providers (like `custom`) into an already-saved config on load,
    so existing users don't lose it or have it silently missing after this update.
18. Testing — **not started** (no automated tests exist yet)
19. Full end-to-end QA — **in progress**, real bugs found and fixed this pass:
    - **Muted tab audio bug**: `offscreen.ts` routed the captured tab audio only through a silenced
      gain node and never reconnected it to `audioContext.destination` — tab capture reroutes ALL
      of a tab's audio into the MediaStream, so without a real playback connection the tab went
      silent for the whole recording. Fixed: `source.connect(audioContext.destination)` added
      alongside the existing (still-silent) analysis path.
    - **No transcript in the real extension bug**: the manifest had no `content_security_policy`,
      so Chrome's default MV3 extension-page CSP (`script-src 'self'; object-src 'self'`) applied,
      which blocks `WebAssembly.instantiate` — the sherpa-onnx WASM model would silently fail to
      load inside the actual extension (it worked in the earlier standalone verification because
      that was a plain webpage, not an extension page, so the stricter CSP didn't apply). Fixed:
      added `content_security_policy.extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"`
      to `manifest.config.ts`.
    - User-reported UX gaps, also fixed: `SessionDetail.tsx` only ever showed the generated note
      ("Note not generated yet" with no way to see the transcript that *was* captured) — added a
      Note/Transcript tab toggle, transcript entries list, "Export transcript" (.txt) and
      "Export note" (.md) buttons (`src/ui/shared/download.ts`, uses `chrome.downloads.download`
      on a Blob URL — added the `downloads` permission), and an "Open full view ↗" button that
      opens the same popup UI in a real browser tab via `chrome.tabs.create` with
      `?sessionId=...&view=tab` (popup's fixed 400px width becomes `min-height:100vh` full layout
      in that mode — see `index.html`'s `body.standalone` rule and `App.tsx`'s `standalone` flag).
    - **Environment note for whoever tests next**: the official signed Google Chrome build silently
      ignores `--load-extension`/`--disable-extensions-except` (logged as "is not allowed in Google
      Chrome, ignoring" — confirmed by checking `<profile>/Default/Preferences`, the extension
      never actually loaded despite no visible error). **Brave loads it fine** with identical flags.
      If testing headlessly again: `google-chrome` won't work for `--load-extension`, use
      `brave-browser` (or a real manual "Load unpacked" via chrome://extensions in either browser,
      which isn't restricted — only the CLI flag is).
    - Still not done: a clean full manual click-through in the actual popup UI (testing so far was
      via a real user session + one aborted automated CDP harness, notes below).
20. Final QA agent review — not started
21. Fix remaining issues — depends on 18-20
22. Final verification and commits — depends on 18-21

## Notes / gotchas for future sessions

- `prompt.md` at project root is the full spec — re-read it if unsure of requirements.
- Repo root (`Ai Automatic Note Tracker/`) is NOT a git repo yet; `stt-engine/` (nested) IS its own
  git repo (has `.git`) — keep the extension's own git history separate, don't run git commands
  from inside `stt-engine/` expecting them to affect the extension project.
- Do not copy `stt-engine/{bolo,bolo-core,bolo-gui,vendor,lib,target,.cargo,sherpa-onnx-alsa}` into
  the extension — only the model folder's contents are needed, and only 4 files from it
  (encoder.onnx, decoder.onnx, joiner.onnx, tokens.txt).
