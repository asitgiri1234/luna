import { exec } from "node:child_process";

import {
  AiError,
  type AiStreamRequest,
  type ProviderHealth,
} from "../../../shared/ai";
import { createLogger } from "../../../shared/logger";
import type { MainAiProvider } from "./provider";

/**
 * # Ollama provider (main process)
 *
 * The only module in the entire application that talks to Ollama.
 * Speaks Ollama's native HTTP API directly (no SDK dependency) so we
 * fully control streaming, cancellation, timeouts, and error
 * classification.
 *
 * Responsibilities:
 * - stream `/api/chat` responses as newline-delimited JSON
 * - map sampling options to Ollama's `options` shape
 * - watchdog timeouts (slow first token while the model loads; silence
 *   mid-stream)
 * - classify failures into the shared `AiErrorCode` taxonomy, including
 *   probing the PATH to distinguish "not installed" from "not running"
 */

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

/** Generous: on first use Ollama may need to load the model into memory. */
const FIRST_TOKEN_TIMEOUT_MS = 180_000;
/** If the stream goes silent this long mid-generation, give up. */
const IDLE_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 3_000;

const log = createLogger("main:ai:ollama");

interface OllamaChatChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}

function isOllamaOnPath(): Promise<boolean> {
  const probe = process.platform === "win32" ? "where ollama" : "which ollama";
  return new Promise((resolve) => exec(probe, (error) => resolve(!error)));
}

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause as { code?: string; errors?: { code?: string }[] } | undefined;
  const codes = [cause?.code, ...(cause?.errors?.map((e) => e.code) ?? [])];
  return codes.some((code) => code === "ECONNREFUSED" || code === "ENOTFOUND");
}

/** Turn a failure to even reach Ollama into the friendliest possible error. */
async function classifyConnectionFailure(): Promise<AiError> {
  const installed = await isOllamaOnPath();
  return installed
    ? new AiError(
        "provider-unavailable",
        `Ollama is installed but not reachable at ${OLLAMA_BASE_URL}.`,
      )
    : new AiError("provider-not-installed", "The Ollama CLI was not found on this system.");
}

export class OllamaMainProvider implements MainAiProvider {
  readonly id = "ollama";

  async *stream(request: AiStreamRequest, signal: AbortSignal): AsyncGenerator<string> {
    const watchdog = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const armWatchdog = (ms: number): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        watchdog.abort(new AiError("timeout", `Ollama stopped responding after ${ms / 1000}s.`));
      }, ms);
    };

    try {
      armWatchdog(FIRST_TOKEN_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            stream: true,
            options: {
              temperature: request.options?.temperature,
              top_p: request.options?.topP,
              num_predict: request.options?.maxTokens,
            },
          }),
          signal: AbortSignal.any([signal, watchdog.signal]),
        });
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        if (watchdog.signal.aborted) throw watchdog.signal.reason;
        if (isConnectionError(error)) throw await classifyConnectionFailure();
        throw error;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        const detail = body.error ?? `Ollama returned HTTP ${response.status}.`;
        if (response.status === 404 || /not found/i.test(detail)) {
          throw new AiError(
            "model-missing",
            `The model "${request.model}" is not available locally.`,
          );
        }
        throw new AiError("unknown", detail);
      }

      if (!response.body) throw new AiError("unknown", "Ollama returned an empty response.");

      // Ollama streams newline-delimited JSON chunks.
      const decoder = new TextDecoder();
      let pending = "";
      try {
        for await (const bytes of response.body) {
          pending += decoder.decode(bytes as Uint8Array, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const chunk = JSON.parse(line) as OllamaChatChunk;
            if (chunk.error) throw new AiError("unknown", chunk.error);
            const token = chunk.message?.content;
            if (token) {
              armWatchdog(IDLE_TIMEOUT_MS);
              yield token;
            }
            if (chunk.done) return;
          }
        }
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        if (watchdog.signal.aborted) throw watchdog.signal.reason;
        throw error;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (!response.ok) {
        return { ok: false, code: "unknown", message: `Ollama returned HTTP ${response.status}.` };
      }
      const body = (await response.json()) as { models?: { name?: string }[] };
      const models = (body.models ?? [])
        .map((model) => model.name)
        .filter((name): name is string => typeof name === "string");
      return { ok: true, models };
    } catch (error) {
      log.warn("health check failed", { error: String(error) });
      const classified = isConnectionError(error)
        ? await classifyConnectionFailure()
        : new AiError("provider-unavailable", "Ollama did not respond to the health check.");
      return { ok: false, code: classified.code, message: classified.message };
    }
  }
}
