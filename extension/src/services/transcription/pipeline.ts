import type { AudioChunk, TranscriptSegment, TranscriptionProvider } from "../../types/transcription";

export class AudioPipeline {
  constructor(
    private readonly provider: TranscriptionProvider,
    private readonly onSegment: (segment: TranscriptSegment) => void,
  ) {}

  async start(): Promise<void> {
    await this.provider.init();
  }

  async pushChunk(chunk: AudioChunk): Promise<void> {
    const segment = await this.provider.transcribe(chunk);
    if (segment) {
      this.onSegment(segment);
    }
  }

  stop(): void {
    this.provider.dispose();
  }
}
