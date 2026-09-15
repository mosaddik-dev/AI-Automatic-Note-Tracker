import { useEffect, useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import type { AIProviderConfig } from "@/types/ai";
import {
  STORAGE_KEY_AI_PROVIDER_CONFIGS,
  STORAGE_KEY_SCREENSHOT_SETTINGS,
  DEFAULT_SCREENSHOT_SETTINGS,
  RECOMMENDED_MODELS,
  type ScreenshotSettings,
} from "@/ui/shared/storageKeys";
import { SpotlightCard } from "@/ui/shared/SpotlightCard";
import { ProviderConfigRow } from "./components/ProviderConfigRow";

const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  { id: "google", apiKey: "", model: RECOMMENDED_MODELS.google, enabled: false, priority: 1 },
  { id: "groq", apiKey: "", model: RECOMMENDED_MODELS.groq, enabled: false, priority: 2 },
  { id: "openrouter", apiKey: "", model: RECOMMENDED_MODELS.openrouter, enabled: false, priority: 3 },
];

export function App() {
  const [providers, setProviders] = useState<AIProviderConfig[]>(DEFAULT_PROVIDERS);
  const [screenshotSettings, setScreenshotSettings] = useState<ScreenshotSettings>(
    DEFAULT_SCREENSHOT_SETTINGS,
  );
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    chrome.storage.local
      .get([STORAGE_KEY_AI_PROVIDER_CONFIGS, STORAGE_KEY_SCREENSHOT_SETTINGS])
      .then((result) => {
        const stored = result[STORAGE_KEY_AI_PROVIDER_CONFIGS] as AIProviderConfig[] | undefined;
        if (stored?.length) setProviders(stored);
        const shot = result[STORAGE_KEY_SCREENSHOT_SETTINGS] as ScreenshotSettings | undefined;
        if (shot) setScreenshotSettings(shot);
      });
  }, []);

  function updateProvider(index: number, next: AIProviderConfig) {
    setProviders((prev) => prev.map((p, i) => (i === index ? next : p)));
  }

  function moveProvider(index: number, direction: "up" | "down") {
    setProviders((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority);
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= sorted.length) return prev;
      const a = sorted[index];
      const b = sorted[target];
      return sorted.map((p) =>
        p.id === a.id ? { ...p, priority: b.priority } : p.id === b.id ? { ...p, priority: a.priority } : p,
      );
    });
  }

  async function save() {
    await chrome.storage.local.set({
      [STORAGE_KEY_AI_PROVIDER_CONFIGS]: providers,
      [STORAGE_KEY_SCREENSHOT_SETTINGS]: screenshotSettings,
    });
    setStatus("Saved");
    setTimeout(() => setStatus(""), 1500);
  }

  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);

  return (
    <div className="min-h-screen bg-neutral-950 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_50%)] px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-2xl font-semibold text-transparent"
        >
          AI Note Tracker — Settings
        </motion.h1>
        <p className="mb-8 mt-1 text-sm text-neutral-500">
          Configure AI providers for note generation (used in priority order, top to bottom, as an
          automatic fallback chain) and screenshot capture behavior.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <SpotlightCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-neutral-200">AI Providers (fallback order)</h2>
            {sortedProviders.map((config, i) => (
              <ProviderConfigRow
                key={config.id}
                config={config}
                onChange={(next) => updateProvider(providers.indexOf(config), next)}
                onMove={(dir) => moveProvider(i, dir)}
              />
            ))}
          </SpotlightCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <SpotlightCard className="mb-6">
            <h2 className="mb-4 text-sm font-semibold text-neutral-200">Screenshot Capture</h2>
            <label className="mb-4 flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={screenshotSettings.enabled}
                onChange={(e) =>
                  setScreenshotSettings({
                    ...screenshotSettings,
                    enabled: (e.target as HTMLInputElement).checked,
                  })
                }
                className="accent-indigo-500"
              />
              Capture screenshots during recording
            </label>
            <label className="mb-1 block text-xs font-medium text-neutral-400">
              Sensitivity ({Math.round(screenshotSettings.sensitivity * 100)}% change required)
            </label>
            <input
              type="range"
              min="0.02"
              max="0.3"
              step="0.01"
              value={screenshotSettings.sensitivity}
              onInput={(e) =>
                setScreenshotSettings({
                  ...screenshotSettings,
                  sensitivity: parseFloat((e.target as HTMLInputElement).value),
                })
              }
              className="w-full accent-indigo-500"
            />
            <p className="mt-2 text-xs text-neutral-600">
              Lower = more sensitive (captures more screenshots). Higher = only captures big visual
              changes (e.g. slide transitions).
            </p>
          </SpotlightCard>
        </motion.div>

        <div className="sticky bottom-6 flex items-center gap-3 rounded-xl border border-white/10 bg-neutral-900/90 px-4 py-3 backdrop-blur">
          <button
            onClick={save}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
          >
            Save settings
          </button>
          <AnimatePresence>
            {status && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium text-emerald-400"
              >
                {status}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
