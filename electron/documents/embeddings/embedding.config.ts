/**
 * # Embedding configuration
 *
 * The single place to tune how Luna produces embeddings. Mirrors the AI
 * core's `ai.config.ts`: nothing else hardcodes the model, host, or
 * batching. `EmbeddingService` reads `defaultEmbeddingConfig` but accepts
 * an override object, so a future settings surface can supply user
 * preferences without touching the service.
 *
 * The model must be an embedding model pulled into Ollama, e.g.
 * `ollama pull nomic-embed-text`.
 */

export interface EmbeddingConfig {
  /** Provider that serves embeddings (only Ollama today). */
  providerId: string;
  /** Base URL of the local Ollama server. */
  host: string;
  /** Embedding model id, as Ollama knows it. */
  model: string;
  /** Chunks per request to `/api/embed` (bounds memory + keeps it responsive). */
  batchSize: number;
  /** Abort a single batch request after this long. */
  requestTimeoutMs: number;
}

export const defaultEmbeddingConfig: EmbeddingConfig = {
  providerId: "ollama",
  host: "http://127.0.0.1:11434",
  model: "nomic-embed-text",
  batchSize: 16,
  requestTimeoutMs: 120_000,
};
