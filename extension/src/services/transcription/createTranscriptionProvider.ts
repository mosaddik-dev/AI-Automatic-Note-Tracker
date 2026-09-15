import type { TranscriptionProvider } from "../../types/transcription";
import { LocalBengaliSTT } from "./LocalBengaliSTT";

export function createTranscriptionProvider(): TranscriptionProvider {
  return new LocalBengaliSTT();
}
