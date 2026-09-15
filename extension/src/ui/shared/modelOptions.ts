import type { AIProviderId } from "@/types/ai";

export interface ModelOption {
  value: string;
  /** Short quality/speed tag shown next to the model name, e.g. "Fast", "Best". */
  tag: string;
}

/**
 * Curated model choices per provider for the Settings dropdown, tagged by
 * rough speed/quality tradeoff. Free-tier-friendly picks, since that's what
 * this extension is built around. Model names churn constantly (see
 * RECOMMENDED_MODELS in storageKeys.ts and its history) — each list ends
 * with a "custom" entry so a stale dropdown never blocks typing a model id
 * directly, and MODEL_LIST_URLS (ProviderConfigRow.tsx) links to the
 * provider's live, current model list for verification.
 * Last checked: 2026-09.
 */
// "custom" has no preset list (it's a user-defined endpoint) — intentionally omitted.
export const MODEL_OPTIONS: Partial<Record<AIProviderId, ModelOption[]>> = {
  google: [
    { value: "gemini-3.5-flash-lite", tag: "Fast" },
    { value: "gemini-3.6-flash", tag: "Best" },
    { value: "gemini-3.1-flash-lite", tag: "Normal" },
    { value: "custom", tag: "Custom…" },
  ],
  groq: [
    { value: "openai/gpt-oss-20b", tag: "Fast" },
    { value: "openai/gpt-oss-120b", tag: "Best" },
    { value: "qwen/qwen3-32b", tag: "Complex task" },
    { value: "llama-3.1-8b-instant", tag: "Normal" },
    { value: "custom", tag: "Custom…" },
  ],
  openrouter: [
    { value: "openrouter/auto", tag: "Best (auto-routes)" },
    { value: "qwen/qwen3-coder:free", tag: "Fast (free)" },
    { value: "custom", tag: "Custom…" },
  ],
};

export const CUSTOM_MODEL_VALUE = "custom";
