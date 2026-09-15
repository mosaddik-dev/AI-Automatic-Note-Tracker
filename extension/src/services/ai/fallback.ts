import type { AIProviderConfig, GeneratedNote, NoteGenerationInput } from "@/types/ai";
import { getProvider } from "./registry";
import { consoleLogger, type Logger } from "./logger";

/**
 * Tries each enabled provider config in priority order (lowest `priority` number first).
 * Falls through to the next provider on any error (network failure, rate limit, invalid key, etc.)
 * and only throws once every provider has failed, with an aggregated error message.
 */
export async function generateNoteWithFallback(
  input: NoteGenerationInput,
  configs: AIProviderConfig[],
  logger: Logger = consoleLogger,
): Promise<GeneratedNote> {
  const ordered = configs.filter((c) => c.enabled).sort((a, b) => a.priority - b.priority);

  if (ordered.length === 0) {
    throw new Error("No enabled AI provider configured");
  }

  const failures: string[] = [];

  for (const config of ordered) {
    const provider = getProvider(config.id);
    try {
      const note = await provider.generateNote(input, config);
      logger.info(`note generated successfully via "${config.id}"`);
      return note;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`provider "${config.id}" failed, trying next: ${message}`);
      failures.push(`${config.id}: ${message}`);
    }
  }

  throw new Error(`All AI providers failed:\n${failures.join("\n")}`);
}
