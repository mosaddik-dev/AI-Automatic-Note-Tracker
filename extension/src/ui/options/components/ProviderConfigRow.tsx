import type { AIProviderConfig } from "@/types/ai";

const LABELS: Record<AIProviderConfig["id"], string> = {
  google: "Google",
  groq: "Groq",
  openrouter: "OpenRouter",
};

interface Props {
  config: AIProviderConfig;
  onChange: (next: AIProviderConfig) => void;
  onMove: (direction: "up" | "down") => void;
}

export function ProviderConfigRow({ config, onChange, onMove }: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 py-3 last:border-0">
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
  );
}
