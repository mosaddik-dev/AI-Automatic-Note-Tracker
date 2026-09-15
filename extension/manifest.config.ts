import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "AI Automatic Note Tracker",
  description: "Local Bengali speech-to-text meeting/lecture notes with AI-generated summaries.",
  version: "0.1.0",
  icons: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  action: {
    default_popup: "src/ui/popup/index.html",
  },
  options_page: "src/ui/options/index.html",
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: [
    "tabCapture",
    "storage",
    "unlimitedStorage",
    "offscreen",
    "activeTab",
    "scripting",
  ],
  host_permissions: ["<all_urls>"],
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
    },
  ],
  // Note: transcription-runtime/* (the sherpa-onnx WASM ASR build) is loaded
  // only from src/services/transcription/offscreen.html, which is itself a
  // privileged extension page (chrome-extension://...) — it can load
  // public/ assets directly and does NOT need a web_accessible_resources
  // entry (that mechanism is only for exposing resources to content scripts
  // running in the context of arbitrary third-party web pages).
  web_accessible_resources: [],
});
