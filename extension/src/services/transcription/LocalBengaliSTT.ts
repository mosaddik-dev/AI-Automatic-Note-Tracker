import type { AudioChunk, TranscriptSegment, TranscriptionProvider } from "../../types/transcription";

/**
 * Thin wrapper around sherpa-onnx's official WebAssembly ASR build
 * (`public/transcription-runtime/`), built from upstream k2-fsa/sherpa-onnx
 * with our Bengali streaming zipformer2 model baked in (see TODO.md, Phase 0).
 *
 * This is Emscripten-generated glue, not an ES module: it expects a global
 * `Module` object to exist before it loads, and it attaches its own globals
 * (`createOnlineRecognizer`, `OnlineRecognizer`, `OnlineStream`) once loaded.
 * There are no upstream types for any of this, hence the narrow `any` usage
 * confined to this one file.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SherpaModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SherpaRecognizer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SherpaStream = any;

declare global {
  interface Window {
    Module?: SherpaModule;
    createOnlineRecognizer?: (module: SherpaModule) => SherpaRecognizer;
  }
}

const RUNTIME_BASE = "transcription-runtime/";
const MAIN_ASR_JS = "sherpa-onnx-wasm-main-asr.js";
const ASR_HELPERS_JS = "sherpa-onnx-asr.js";

function runtimeUrl(path: string): string {
  return chrome.runtime.getURL(RUNTIME_BASE + path);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadSherpaOnnxModule(): Promise<SherpaModule> {
  const module: SherpaModule = {
    locateFile: (path: string) => runtimeUrl(path),
  };
  window.Module = module;

  const ready = new Promise<void>((resolve) => {
    module.onRuntimeInitialized = () => resolve();
  });

  await loadScript(runtimeUrl(MAIN_ASR_JS));
  await ready;
  await loadScript(runtimeUrl(ASR_HELPERS_JS));

  return module;
}

export class LocalBengaliSTT implements TranscriptionProvider {
  private module: SherpaModule | null = null;
  private recognizer: SherpaRecognizer | null = null;
  private stream: SherpaStream | null = null;

  async init(): Promise<void> {
    this.module = await loadSherpaOnnxModule();

    if (typeof window.createOnlineRecognizer !== "function") {
      throw new Error("sherpa-onnx-asr.js did not attach createOnlineRecognizer");
    }
    // Passing no config uses the runtime's built-in defaults, which already
    // match the original Bolo app exactly: zipformer2 transducer, 16kHz,
    // greedy_search, rule1=2.4/rule2=1.2/rule3=20 (see sherpa-onnx-asr.js).
    this.recognizer = window.createOnlineRecognizer(this.module);
    this.stream = this.recognizer.createStream();
  }

  async transcribe(chunk: AudioChunk): Promise<TranscriptSegment | null> {
    if (!this.recognizer || !this.stream) {
      throw new Error("LocalBengaliSTT.init() must be called before transcribe()");
    }

    this.stream.acceptWaveform(chunk.sampleRate, chunk.samples);
    while (this.recognizer.isReady(this.stream)) {
      this.recognizer.decode(this.stream);
    }

    const isEndpoint = this.recognizer.isEndpoint(this.stream);
    const result = this.recognizer.getResult(this.stream);
    const text: string = result?.text ?? "";

    if (isEndpoint) {
      this.recognizer.reset(this.stream);
    }

    if (!text && !isEndpoint) {
      return null;
    }

    return {
      text,
      isFinal: isEndpoint,
      timestampMs: Date.now(),
    };
  }

  reset(): void {
    if (this.recognizer && this.stream) {
      this.recognizer.reset(this.stream);
    }
  }

  dispose(): void {
    this.stream?.free?.();
    this.recognizer?.free?.();
    this.stream = null;
    this.recognizer = null;
    this.module = null;
  }
}
