import type { DocumentKind } from "../../../shared/documents";

/**
 * # Retriever types (main process)
 *
 * Shapes for the RetrieverService, which turns a user query into the
 * Top-K most relevant chunks with their scores and metadata. This layer
 * only retrieves — it does not build prompts, call an LLM, or generate a
 * response. Nothing here crosses IPC.
 */

/** Chunk-level metadata carried on a retrieval result. */
export interface RetrievedChunkMeta {
  position: number;
  page?: number;
  headingPath?: string[];
  wordCount: number;
  charCount: number;
}

/** Document-level metadata carried on a retrieval result. */
export interface RetrievedDocumentMeta {
  id: string;
  sourceFileId: string;
  title: string;
  kind: DocumentKind;
  language: string;
  author: string | null;
}

/** One retrieved chunk: its text, similarity score, and full context. */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  /** Cosine similarity to the query, in [-1, 1]. */
  score: number;
  text: string;
  chunk: RetrievedChunkMeta;
  document: RetrievedDocumentMeta;
}

export interface RetrieveOptions {
  /** Number of results to return (Top-K). */
  k?: number;
  /** Restrict retrieval to a single document. */
  documentId?: string;
  /** Minimum cosine similarity to keep a result (configurable threshold). */
  minScore?: number;
  /** Embedding model to query within (defaults to the embedding service's model). */
  model?: string;
  /** Chunk ids to omit (e.g. a chunk the caller already has). */
  excludeChunkIds?: string[];
  /** Drop near-duplicate overlapping chunks (default true). */
  dedupeOverlap?: boolean;
  /** Word-set Jaccard above which two chunks are treated as overlapping (default 0.8). */
  overlapThreshold?: number;
}

/** Default Top-K when the caller doesn't specify one. */
export const DEFAULT_RETRIEVE_K = 5;
/** Default overlap ratio for de-duplicating overlapping chunks. */
export const DEFAULT_OVERLAP_THRESHOLD = 0.8;
