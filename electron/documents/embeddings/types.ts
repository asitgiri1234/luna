/**
 * # Embedding types (main process)
 *
 * Shapes for the EmbeddingService pipeline. Embeddings are produced in
 * the main process (Ollama HTTP + SQLite) and are not part of any IPC
 * contract yet — there is no retrieval / vector search in this milestone,
 * so these types stay main-side.
 */

/** A stored embedding for one chunk under one model. */
export interface EmbeddingRecord {
  id: string;
  chunkId: string;
  model: string;
  dimensions: number;
  /** The vector; persisted as a JSON array of numbers. */
  embedding: number[];
  createdAt: number;
}

/** A chunk that still needs an embedding for the target model. */
export interface PendingChunk {
  id: string;
  text: string;
}

/** Progress emitted to the caller as batches complete. */
export interface EmbedProgress {
  model: string;
  /** Chunks that needed embedding when the run started. */
  total: number;
  /** Chunks attempted so far (embedded + failed). */
  processed: number;
  embedded: number;
  /** Chunks already embedded before this run (counted up front). */
  skipped: number;
  failed: number;
}

export type EmbedProgressListener = (progress: EmbedProgress) => void;

/** Options for one embedding run. */
export interface EmbedOptions {
  /** Limit to a single document's chunks; omit to embed all pending chunks. */
  documentId?: string;
  /** Override the configured embedding model. */
  model?: string;
  /** Override the configured batch size. */
  batchSize?: number;
  /** Cancel an in-flight run between (and during) batches. */
  signal?: AbortSignal;
  /** Called after each batch (and once up front) with cumulative progress. */
  onProgress?: EmbedProgressListener;
}

/** Summary returned when a run finishes. */
export interface EmbedResult {
  model: string;
  /** Vector length of the produced embeddings, or null if none were made. */
  dimensions: number | null;
  total: number;
  embedded: number;
  skipped: number;
  failed: number;
}

export type EmbeddingErrorCode =
  | "provider-not-installed"
  | "provider-unavailable"
  | "model-missing"
  | "db-unavailable"
  | "cancelled"
  | "unknown";

/** Canonical embedding failure. */
export class EmbeddingError extends Error {
  constructor(
    public readonly code: EmbeddingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}
