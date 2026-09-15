# AI Automatic Note Tracker — Progress Tracker

> Read this file first in any new session to know exactly where things stand.
> Update it after every meaningful step (don't wait until "done").

## Current Phase
**Phase 0 — Extract & verify local Bengali STT model** (see prompt.md step 0)

## Status: IN PROGRESS — architecture decided, build not started yet

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
- [ ] If wasm build fails or is impractical in this environment (timeouts, resources):
      STOP, document the specific blocker here, and re-evaluate architecture with the user
      before proceeding
- [ ] First git commit: `feat: integrate local Bengali speech-to-text model` (model extraction only,
      no other extension code mixed in) — **note: `stt-engine/` currently has NO git repo at the
      Ai Automatic Note Tracker root; need to `git init` the extension project root first**

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

### After all agents finish: reconciliation checklist
- [ ] Confirm `src/ui/popup/main.tsx` and `src/ui/options/main.tsx` both `import "../globals.css"`
      (or correct relative path) — Tailwind won't apply otherwise.
- [ ] Cross-check Agent 3's assumed storage function names/signatures and `chrome.storage.local` key
      (`"ai_provider_configs"` was the suggested name) against Agent 1's actual
      `src/services/storage/index.ts` exports — reconcile any mismatches.
- [ ] Cross-check Agent 3's assumed background-mediated screenshot-capture message shape against
      Agent 1's actual `src/background/messages.ts` discriminated union — reconcile any mismatches.
- [ ] Run `cd extension && npm install` (nothing installed yet) then `npm run typecheck` and fix
      whatever the three independently-written codebases get wrong about each other's exact exports.

## Not started yet (Phases 1–21 from prompt.md, in order)

1. Local STT model integration ← **we are here (Phase 0 above)**
2. Manifest V3 extension foundation
3. Tab audio capture
4. Audio → local STT pipeline
5. Transcript session management
6. Persistent storage
7. AI provider abstraction
8. Google provider
9. Groq provider
10. OpenRouter provider
11. Automatic fallback system
12. AI note generation
13. Notion-ready output
14. Intelligent screenshot detection
15. Screenshot storage/association
16. Dashboard/session history
17. Settings
18. Testing
19. Full end-to-end QA
20. Final QA agent review
21. Fix remaining issues
22. Final verification and commits

## Notes / gotchas for future sessions

- `prompt.md` at project root is the full spec — re-read it if unsure of requirements.
- Repo root (`Ai Automatic Note Tracker/`) is NOT a git repo yet; `stt-engine/` (nested) IS its own
  git repo (has `.git`) — keep the extension's own git history separate, don't run git commands
  from inside `stt-engine/` expecting them to affect the extension project.
- Do not copy `stt-engine/{bolo,bolo-core,bolo-gui,vendor,lib,target,.cargo,sherpa-onnx-alsa}` into
  the extension — only the model folder's contents are needed, and only 4 files from it
  (encoder.onnx, decoder.onnx, joiner.onnx, tokens.txt).
