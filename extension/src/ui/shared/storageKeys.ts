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
