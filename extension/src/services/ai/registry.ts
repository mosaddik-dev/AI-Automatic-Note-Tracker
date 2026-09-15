import type { AIProvider, AIProviderId } from "@/types/ai";
import { GoogleProvider } from "./providers/GoogleProvider";
import { GroqProvider } from "./providers/GroqProvider";
import { OpenRouterProvider } from "./providers/OpenRouterProvider";
import { CustomOpenAiCompatibleProvider } from "./providers/CustomOpenAiCompatibleProvider";

const providers: Record<AIProviderId, AIProvider> = {
  google: new GoogleProvider(),
  groq: new GroqProvider(),
  openrouter: new OpenRouterProvider(),
  custom: new CustomOpenAiCompatibleProvider(),
};

export function getProvider(id: AIProviderId): AIProvider {
  const provider = providers[id];
  if (!provider) {
    throw new Error(`Unknown AI provider id: ${id}`);
  }
  return provider;
}
