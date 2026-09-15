/**
 * chrome.storage.local keys used by the settings UI. Other modules (the AI
 * fallback chain, background service worker) should read these same keys.
 */
export const STORAGE_KEY_AI_PROVIDER_CONFIGS = "ai_provider_configs";
export const STORAGE_KEY_SCREENSHOT_SETTINGS = "screenshot_settings";

export interface ScreenshotSettings {
  enabled: boolean;
  /** 0-1 fraction of changed pixels required to keep a new screenshot. */
  sensitivity: number;
  /** Minimum milliseconds between screenshot capture attempts. */
  minIntervalMs: number;
}

export const DEFAULT_SCREENSHOT_SETTINGS: ScreenshotSettings = {
  enabled: true,
  sensitivity: 0.08,
  minIntervalMs: 4000,
};

/**
 * AI providers frequently retire model names outright (not just deprecate —
 * calls to a decommissioned model fail immediately with a 404/400). Keep
 * this map updated when that happens; it's also surfaced as a "Use
 * recommended" reset button in the settings UI, since a config saved before
 * a retirement will otherwise keep failing silently until the user notices.
 * Last checked: 2026-09 — gemini-1.5-flash and Groq's llama-3.1/3.3 models
 * were retired around 2026-08; gemini-2.5-flash was in turn cut off from new
 * users shortly after (Google's own error response names the replacement).
 */
export const RECOMMENDED_MODELS: Record<"google" | "groq" | "openrouter", string> = {
  google: "gemini-3.6-flash",
  groq: "openai/gpt-oss-20b",
  openrouter: "openrouter/auto",
};
