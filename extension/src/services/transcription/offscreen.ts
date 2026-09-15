import type { RuntimeMessage } from "../../background/messages";
import type { AudioChunk } from "../../types/transcription";
import { createTranscriptionProvider } from "./createTranscriptionProvider";
import { AudioPipeline } from "./pipeline";

const TARGET_SAMPLE_RATE = 16000;
const PROCESSOR_BUFFER_SIZE = 4096;

interface ActiveCapture {
  tabId: number;
  sessionId: string;
  stream: MediaStream;
  audioContext: AudioContext;
  processor: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
  pipeline: AudioPipeline;
}

let activeCapture: ActiveCapture | null = null;

function resampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === TARGET_SAMPLE_RATE) {
    return input;
  }
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    output[i] = input[Math.floor(i * ratio)];
  }
  return output;
}

async function startCapture(tabId: number, streamId: string, sessionId: string): Promise<void> {
  if (activeCapture) {
    stopCapture();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-expect-error chrome-specific constraints for tab capture
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);

  const provider = createTranscriptionProvider();
  const pipeline = new AudioPipeline(provider, (segment) => {
    const message: RuntimeMessage = {
      type: "transcript-segment",
      tabId,
      sessionId,
      segment,
    };
    chrome.runtime.sendMessage(message);
  });
  await pipeline.start();

  processor.onaudioprocess = (event) => {
    const raw = event.inputBuffer.getChannelData(0);
    const resampled = resampleTo16k(raw, audioContext.sampleRate);
    const chunk: AudioChunk = { samples: resampled, sampleRate: TARGET_SAMPLE_RATE };
    void pipeline.pushChunk(chunk);
  };

  // Capturing a tab via chrome.tabCapture reroutes ALL of that tab's audio
  // into this MediaStream — it stops playing through the tab's own output
  // entirely. If we don't explicitly reconnect it to this AudioContext's
  // destination, the tab goes silent for the user for the whole recording.
  source.connect(audioContext.destination);

  // Separately, feed the same source into the analysis path. A
  // ScriptProcessorNode only fires onaudioprocess while connected (directly
  // or indirectly) to a destination, but we don't want its pass-through
  // output audible (that would double up the audio we already play above),
  // so it terminates in a silent (gain=0) sink instead.
  source.connect(processor);
  const silentSink = audioContext.createGain();
  silentSink.gain.value = 0;
  processor.connect(silentSink);
  silentSink.connect(audioContext.destination);

  activeCapture = { tabId, sessionId, stream, audioContext, processor, source, pipeline };
}

function stopCapture(): void {
  if (!activeCapture) return;
  activeCapture.processor.disconnect();
  activeCapture.source.disconnect();
  activeCapture.pipeline.stop();
  activeCapture.stream.getTracks().forEach((track) => track.stop());
  void activeCapture.audioContext.close();
  activeCapture = null;
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === "capture-tab-audio") {
    void startCapture(message.tabId, message.streamId, message.sessionId);
  } else if (message.type === "stop-tab-audio") {
    if (activeCapture?.tabId === message.tabId) {
      stopCapture();
    }
  }
});
