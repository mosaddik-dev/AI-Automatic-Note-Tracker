import path from "node:path";
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // framer-motion (and any other React-targeting lib) is aliased to Preact's
      // React-compat shim so we don't need a second React runtime.
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react-dom/test-utils": "preact/test-utils",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
  build: {
    rollupOptions: {
      input: {
        offscreen: "src/services/transcription/offscreen.html",
      },
    },
  },
});
