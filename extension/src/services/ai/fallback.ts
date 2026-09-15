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

  logger.info(`starting note generation — provider order: ${ordered.map((c) => c.id).join(" → ")}`);

  for (let i = 0; i < ordered.length; i++) {
    const config = ordered[i];
    const provider = getProvider(config.id);
    logger.info(`calling ${config.id} (model: ${config.model || "default"})…`);
    try {
      const note = await provider.generateNote(input, config);
      logger.info(`${config.id} responded successfully (${note.markdown.length} chars)`);
      return note;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`${config.id} failed: ${message}`);
      failures.push(`${config.id}: ${message}`);
      const next = ordered[i + 1];
      if (next) {
        logger.warn(`falling back to ${next.id}…`);
      }
    }
  }

  logger.error(`all providers failed`);
  throw new Error(`All AI providers failed:\n${failures.join("\n")}`);
}
