import type { AudioChunk, TranscriptSegment, TranscriptionProvider } from "../../types/transcription";

const EMIT_INTERVAL_MS = 2000;
const PLACEHOLDER_WORDS = ["এটি", "একটি", "পরীক্ষামূলক", "ট্রান্সক্রিপ্ট", "অংশ"];

export class StubTranscriptionProvider implements TranscriptionProvider {
  private samplesSinceEmit = 0;
  private wordIndex = 0;
  private sampleRate = 16000;

  async init(): Promise<void> {
    this.samplesSinceEmit = 0;
    this.wordIndex = 0;
  }

  async transcribe(chunk: AudioChunk): Promise<TranscriptSegment | null> {
    this.sampleRate = chunk.sampleRate;
    this.samplesSinceEmit += chunk.samples.length;

    const emitEverySamples = (EMIT_INTERVAL_MS / 1000) * this.sampleRate;
    if (this.samplesSinceEmit < emitEverySamples) {
      return null;
    }
    this.samplesSinceEmit = 0;

    const word = PLACEHOLDER_WORDS[this.wordIndex % PLACEHOLDER_WORDS.length];
    this.wordIndex += 1;

    return {
      text: word,
      isFinal: true,
      timestampMs: Date.now(),
    };
  }

  reset(): void {
    this.samplesSinceEmit = 0;
    this.wordIndex = 0;
  }

  dispose(): void {
    this.reset();
  }
}
