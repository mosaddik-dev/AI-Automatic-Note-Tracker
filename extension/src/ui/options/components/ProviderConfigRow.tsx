import type { AIProviderConfig } from "@/types/ai";
import { RECOMMENDED_MODELS } from "@/ui/shared/storageKeys";

const LABELS: Record<AIProviderConfig["id"], string> = {
  google: "Google",
  groq: "Groq",
  openrouter: "OpenRouter",
};

const MODEL_LIST_URLS: Record<AIProviderConfig["id"], string> = {
  google: "https://ai.google.dev/gemini-api/docs/models",
  groq: "https://console.groq.com/docs/models",
  openrouter: "https://openrouter.ai/models",
};

interface Props {
  config: AIProviderConfig;
  onChange: (next: AIProviderConfig) => void;
  onMove: (direction: "up" | "down") => void;
}

export function ProviderConfigRow({ config, onChange, onMove }: Props) {
  const isOutdated = config.model !== RECOMMENDED_MODELS[config.id];

  return (
    <div className="border-b border-white/5 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-sm font-medium text-neutral-200">{LABELS[config.id]}</span>
        <input
          type="password"
          placeholder="API key"
          value={config.apiKey}
          onInput={(e) => onChange({ ...config, apiKey: (e.target as HTMLInputElement).value })}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-indigo-500/50"
        />
        <input
          type="text"
          placeholder="model"
          value={config.model}
          onInput={(e) => onChange({ ...config, model: (e.target as HTMLInputElement).value })}
          className="w-40 shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-indigo-500/50"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: (e.target as HTMLInputElement).checked })}
            className="accent-indigo-500"
          />
          Enabled
        </label>
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => onMove("up")}
            title="Higher priority"
            className="rounded-t border border-white/10 bg-white/[0.03] px-1.5 text-[10px] leading-4 text-neutral-400 hover:bg-white/[0.08]"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            title="Lower priority"
            className="rounded-b border border-t-0 border-white/10 bg-white/[0.03] px-1.5 text-[10px] leading-4 text-neutral-400 hover:bg-white/[0.08]"
          >
            ▼
          </button>
        </div>
      </div>

      {isOutdated && (
        <div className="ml-[6.5rem] mt-1.5 flex items-center gap-2 text-[11px] text-amber-400/90">
          <span>
            Model differs from the current recommended default ({RECOMMENDED_MODELS[config.id]}) — if
            generation fails with a 404/"decommissioned" error, providers frequently retire model
            names outright.
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...config, model: RECOMMENDED_MODELS[config.id] })}
            className="shrink-0 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-medium text-amber-300 hover:bg-amber-400/20"
          >
            Use recommended
          </button>
          <a
            href={MODEL_LIST_URLS[config.id]}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-neutral-500 underline hover:text-neutral-300"
          >
            model list ↗
          </a>
        </div>
      )}
    </div>
  );
}
