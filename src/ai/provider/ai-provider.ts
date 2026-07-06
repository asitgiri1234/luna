import type {
  GenerationHandle,
  GenerationRequest,
  ProviderHealth,
  StreamCallbacks,
} from "@/ai/types";

/**
 * # AIProvider — the seam every future feature plugs into
 *
 * The single abstraction the application depends on for inference.
 * Everything above this interface (conversation manager, stores, future
 * memory/tools/vision features) is provider-agnostic; everything below
 * it (IPC bridges, HTTP clients, SDKs) is an implementation detail.
 *
 * Rules:
 * - the rest of `src/` may only import this interface, never a
 *   concrete provider
 * - concrete providers are chosen in `provider-factory.ts` and injected
 *   by the composition root (`src/ai/index.ts`)
 *
 * Implementations today: `OllamaProvider` (delegates to the main
 * process over IPC). Future: cloud providers, mock provider for tests.
 */
export interface AIProvider {
  /** Stable id, matching a main-process provider registration. */
  readonly id: string;

  /**
   * Convenience non-streaming completion: resolves with the full text.
   * Rejects with `AiError` (code `cancelled` if aborted). Future
   * features that need a single answer (summarization, tool planning)
   * use this.
   */
  generate(request: GenerationRequest): Promise<string>;

  /**
   * Streaming completion. Exactly one terminal callback fires
   * (`onDone` or `onError`). Returns a handle that can cancel.
   */
  stream(request: GenerationRequest, callbacks: StreamCallbacks): GenerationHandle;

  /** Cancels an in-flight generation by request id (no-op if finished). */
  cancel(requestId: string): void;

  /** Probes provider availability; never rejects. */
  healthCheck(): Promise<ProviderHealth>;
}
