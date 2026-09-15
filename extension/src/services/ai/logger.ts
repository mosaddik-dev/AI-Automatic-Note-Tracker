import type { GenerationLogEntry } from "@/types/session";

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export const consoleLogger: Logger = {
  info: (message, ...args) => console.info(`[ai] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[ai] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ai] ${message}`, ...args),
};

function formatArgs(args: unknown[]): string {
  if (args.length === 0) return "";
  return " " + args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" ");
}

/**
 * A Logger that also emits a plain GenerationLogEntry to `sink` for every
 * call (in addition to logging to the console), so a UI can show what the
 * AI fallback chain is doing in real time ("calling groq...", "groq failed:
 * ...", "falling back to google...", "google responded successfully").
 */
export function createCollectingLogger(sink: (entry: GenerationLogEntry) => void): Logger {
  function emit(level: GenerationLogEntry["level"], message: string, args: unknown[]) {
    const full = message + formatArgs(args);
    sink({ timestamp: Date.now(), level, message: full });
    consoleLogger[level](message, ...args);
  }
  return {
    info: (message, ...args) => emit("info", message, args),
    warn: (message, ...args) => emit("warn", message, args),
    error: (message, ...args) => emit("error", message, args),
  };
}
