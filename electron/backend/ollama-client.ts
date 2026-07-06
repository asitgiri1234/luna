import { exec } from "node:child_process";

import { AI_MODEL, type AiChatMessage, type ChatErrorCode } from "../../shared/ai";

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

/** Generous: on first use Ollama may need to load the model into memory. */
const FIRST_TOKEN_TIMEOUT_MS = 180_000;
/** If the stream goes silent this long mid-generation, give up. */
const IDLE_TIMEOUT_MS = 60_000;

export class OllamaError extends Error {
  constructor(
    public readonly code: ChatErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OllamaError";
  }
}

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
async function classifyConnectionFailure(): Promise<OllamaError> {
  const installed = await isOllamaOnPath();
  return installed
    ? new OllamaError(
        "ollama-not-running",
        `Ollama is installed but not reachable at ${OLLAMA_BASE_URL}.`,
      )
    : new OllamaError("ollama-not-installed", "The Ollama CLI was not found on this system.");
}

/**
 * Streams a chat completion from the local Ollama server, yielding raw
 * text tokens. Throws `OllamaError` with a classified code on failure;
 * rethrows the caller's abort reason on cancellation.
 */
export async function* streamChat(
  messages: AiChatMessage[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  const watchdog = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const armWatchdog = (ms: number): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      watchdog.abort(new OllamaError("timeout", `Ollama stopped responding after ${ms / 1000}s.`));
    }, ms);
  };

  try {
    armWatchdog(FIRST_TOKEN_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: AI_MODEL, messages, stream: true }),
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
        throw new OllamaError(
          "model-not-found",
          `The model "${AI_MODEL}" is not available locally.`,
        );
      }
      throw new OllamaError("unknown", detail);
    }

    if (!response.body) throw new OllamaError("unknown", "Ollama returned an empty response.");

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
          if (chunk.error) throw new OllamaError("unknown", chunk.error);
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
