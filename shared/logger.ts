/**
 * # Structured logger
 *
 * Tiny, dependency-free structured logger usable from both the main
 * process and the renderer. Every line carries a timestamp, level,
 * scope, message, and optional structured fields:
 *
 *     2026-07-06T09:12:31.412Z INFO  [ai:conversation] generation started { requestId: "…", model: "qwen2.5:3b" }
 *
 * Usage:
 *     const log = createLogger("ai:provider:ollama");
 *     log.info("stream opened", { requestId });
 *
 * The minimum level is process-wide; composition roots raise it to
 * `debug` in development builds.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const CONSOLE_METHOD: Record<LogLevel, "debug" | "info" | "warn" | "error"> = {
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
};

let minLevel: LogLevel = "info";

/** Sets the process-wide minimum level (call once from the composition root). */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function write(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const prefix = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}]`;
  if (fields && Object.keys(fields).length > 0) {
    console[CONSOLE_METHOD[level]](`${prefix} ${message}`, fields);
  } else {
    console[CONSOLE_METHOD[level]](`${prefix} ${message}`);
  }
}

/** Creates a logger bound to a scope, e.g. `ai:conversation` or `main:ipc`. */
export function createLogger(scope: string): Logger {
  return {
    debug: (message, fields) => write("debug", scope, message, fields),
    info: (message, fields) => write("info", scope, message, fields),
    warn: (message, fields) => write("warn", scope, message, fields),
    error: (message, fields) => write("error", scope, message, fields),
  };
}
