/**
 * # Vector types (main process)
 *
 * Shapes for the VectorStore + VectorSearchService. Vectors are stored in
 * `chunk_embeddings` and searched in memory; nothing here crosses IPC.
 * This layer only stores and searches vectors — no prompt augmentation,
 * chat, or LLM calls.
 */

/** A vector as seen by callers (plain array). */
export interface StoredVector {
  chunkId: string;
  documentId: string;
  model: string;
  dimensions: number;
  vector: number[];
}

/**
 * An index entry with a precomputed L2 norm, used for fast cosine
 * similarity. Kept in the VectorStore's in-memory cache.
 */
export interface IndexedVector {
  chunkId: string;
  documentId: string;
  model: string;
  dimensions: number;
  vector: Float32Array;
  norm: number;
}

/** One search hit, carrying its cosine similarity score. */
export interface SimilarityResult {
  chunkId: string;
  documentId: string;
  model: string;
  dimensions: number;
  /** Cosine similarity in [-1, 1]; higher is more similar. */
  score: number;
}

export interface VectorSearchOptions {
  /** Number of nearest neighbors to return (Top-K). */
  k?: number;
  /** Restrict the search to a single document. */
  documentId?: string;
  /** Embedding model to search within (defaults to the store's model). */
  model?: string;
  /** Chunk ids to omit from results (e.g. the query's own chunk). */
  excludeChunkIds?: string[];
  /** Drop results below this similarity. */
  minScore?: number;
}

/** Default Top-K when the caller doesn't specify one. */
export const DEFAULT_TOP_K = 5;
