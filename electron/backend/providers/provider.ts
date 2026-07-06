import type { AiStreamRequest, ProviderHealth } from "../../../shared/ai";

/**
 * # Main-process provider interface
 *
 * A `MainAiProvider` is the backend half of an AI provider: it owns the
 * actual network/process communication with an inference runtime
 * (Ollama today; cloud APIs or other local runtimes later).
 *
 * To add a provider: implement this interface and register it in
 * `registry.ts`. The controller and IPC layers never know which
 * concrete provider serves a request — they route by `providerId`.
 */
export interface MainAiProvider {
  /** Stable id referenced by `AiStreamRequest.providerId` (e.g. "ollama"). */
  readonly id: string;

  /**
   * Streams a chat completion token-by-token. Must throw `AiError` with
   * a classified code on failure, and rethrow `signal.reason` when the
   * caller aborts.
   */
  stream(request: AiStreamRequest, signal: AbortSignal): AsyncGenerator<string>;

  /** Probes availability. Never throws — failures are encoded in the result. */
  healthCheck(): Promise<ProviderHealth>;
}
