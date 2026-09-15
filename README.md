# AI Automatic Note Tracker

A Manifest V3 Chrome/Brave extension that records a browser tab's audio, transcribes it **locally and offline** with an on-device Bengali speech-to-text model (no audio ever leaves your machine for transcription), and turns the transcript into clean, AI-generated notes — with automatic fallback across multiple AI providers, screenshot capture, and a YouTube-captions integration.

## Features

- **Local, offline Bengali speech-to-text** — a real [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) streaming zipformer2 model, compiled to WebAssembly and run entirely in the browser. No audio is ever sent to a server for transcription.
- **Tab audio capture** via an MV3 offscreen document — record any tab (a lecture, a meeting, a video) without the tab going silent for you.
- **AI note generation with automatic fallback** — configure Google Gemini, Groq, OpenRouter, and/or any custom OpenAI-compatible endpoint, in priority order; if one fails (rate limit, bad key, decommissioned model), it automatically falls through to the next.
- **Long-recording support** — transcripts too large for one AI request are automatically split into chunks, generated in order with continuity context between parts, then merged and given a final language-polish pass for natural, consistent prose.
- **Intelligent screenshot capture** — periodically snapshots the tab during recording, keeping only frames that changed meaningfully, and embeds them inline at the right point in both the transcript and the generated note.
- **YouTube captions integration** — when recording a YouTube tab, the video's own caption track (if it has one) is fetched automatically and offered side-by-side with the recorded transcript.
- **Live generation logs** — watch which AI provider is being called, what succeeded, and why a fallback happened, in real time.
- **Session dashboard** — popup and full-tab views of past sessions, with transcript/note/timeline tabs, copy-to-clipboard, and file export.
- **Notion-ready output** — generated notes are also converted to a Notion block structure.

## How it works

```
Tab audio ──▶ Offscreen document ──▶ Local WASM STT model ──▶ Transcript
                                                                  │
                                                                  ▼
                                              AI provider (fallback chain) ──▶ Generated note
                                                                  ▲
                                                     Screenshots (frame-diff capture)
```

1. Click record on a tab. The background service worker requests a `chrome.tabCapture` stream and hands it to an offscreen document (the only context that can hold a MediaStream in MV3).
2. The offscreen document resamples the audio to 16kHz and feeds it into `sherpa-onnx`'s WebAssembly build, which produces streaming Bengali transcript segments locally.
3. Screenshots are periodically captured and kept only when meaningfully different from the last one.
4. On stop, the transcript (chunked if long) is sent through the configured AI providers in priority order to generate structured Markdown notes, with screenshots embedded and a final language-polish pass applied.

## Project structure

```
extension/
├── manifest.config.ts          Manifest V3 definition (@crxjs/vite-plugin)
├── public/transcription-runtime/   The compiled sherpa-onnx WASM model (~103MB)
└── src/
    ├── background/              Service worker: recording lifecycle, message routing
    ├── content/                 Content script (minimal — screenshot page context)
    ├── services/
    │   ├── transcription/       Local STT: WASM wrapper, audio pipeline, offscreen doc
    │   ├── ai/                  Provider abstraction, fallback chain, chunking, polish
    │   ├── screenshot/          Frame-diff capture logic
    │   └── storage/             IndexedDB session persistence
    ├── types/                   Shared TypeScript interfaces
    └── ui/
        ├── popup/               Dashboard: recording control, session history
        ├── options/             Settings: AI providers, screenshot sensitivity
        └── shared/               Shared UI components/utilities
docs/
├── TODO.md                      Full development history and progress log
└── prompt.md                    Original project specification
```

## Getting started

### Prerequisites

- Node.js 18+ and npm
- Chrome or Brave (see note below on Chrome's `--load-extension` restriction — doesn't affect normal "Load unpacked" use)

### Build

```bash
cd extension
npm install
npm run build
```

### Load into the browser

1. Open `brave://extensions` or `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `extension/dist`

### Configure AI providers

Open the extension's **Settings** page and add an API key for at least one provider (Google, Groq, OpenRouter, or a custom OpenAI-compatible endpoint), set your preferred model, enable it, and set fallback priority order. All three built-in providers have free tiers.

### Development

```bash
npm run dev         # Vite dev server (for iterating on UI; still needs Load unpacked to test the full extension)
npm run typecheck   # TypeScript check, no emit
```

## Known limitations

- `chrome.tabs.captureVisibleTab` can only capture the **foreground/active** tab — screenshots pause if you switch away from the recorded tab. This is a Chrome platform restriction, not a bug.
- AI providers retire model names without notice; the Settings page surfaces an "outdated model" warning with a one-click fix when this happens.
- The YouTube captions integration reads an internal (undocumented) page structure, not an official API — it could break if YouTube changes their player internals.
- No automated test suite yet.

See `docs/TODO.md` for the full, detailed development history, architecture decisions, and known gaps.

## Tech stack

Vite + `@crxjs/vite-plugin` · Preact · TypeScript · Tailwind CSS · Framer Motion · [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (WebAssembly) · IndexedDB

## License

MIT — see [LICENSE](LICENSE) — for this project's own code.

The bundled speech-to-text runtime (`extension/public/transcription-runtime/`) is a compiled build
of [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), licensed Apache-2.0. The Bengali
model itself is [alphacep/vosk-model-small-streaming-bn](https://huggingface.co/alphacep/vosk-model-small-streaming-bn).
See `docs/TODO.md` for the full extraction/build process.
