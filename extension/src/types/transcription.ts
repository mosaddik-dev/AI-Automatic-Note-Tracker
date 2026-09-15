export interface AudioChunk {
  samples: Float32Array;
  sampleRate: number;
}

export interface TranscriptSegment {
  text: string;
  isFinal: boolean;
  timestampMs: number;
}

export interface TranscriptionProvider {
  init(): Promise<void>;
  transcribe(chunk: AudioChunk): Promise<TranscriptSegment | null>;
  reset(): void;
  dispose(): void;
}
