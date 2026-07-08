import { createLogger } from "../../../shared/logger";
import { VectorStore } from "./vector.store";
import {
  DEFAULT_TOP_K,
  type IndexedVector,
  type SimilarityResult,
  type VectorSearchOptions,
} from "./vector.types";

/**
 * # VectorSearchService (main process)
 *
 * Cosine-similarity Top-K nearest-neighbor search over the VectorStore's
 * in-memory index. Configurable K, per-result similarity score, optional
 * document filter, duplicate-chunk exclusion, and a caller-supplied
 * exclude list.
 *
 * It does NOT generate query embeddings (no LLM here) — the caller passes
 * a query vector. No retrieval augmentation, chat, or prompt building.
 */

const log = createLogger("main:vectors:search");

/** L2 norm of a plain-number vector. */
function norm(vector: number[]): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  return Math.sqrt(sum);
}

/** Dot product of a query (number[]) and an indexed vector (Float32Array). */
function dot(query: number[], candidate: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < query.length; i += 1) sum += query[i] * candidate[i];
  return sum;
}

export class VectorSearchService {
  private readonly store: VectorStore;

  constructor(store: VectorStore = new VectorStore()) {
    this.store = store;
  }

  /**
   * Returns the Top-K most cosine-similar chunks to `query`, each with its
   * score. Skips vectors of a different dimensionality, excludes the
   * caller's `excludeChunkIds`, and de-duplicates by chunk id.
   */
  searchSimilar(query: number[], options: VectorSearchOptions = {}): SimilarityResult[] {
    const k = Math.max(0, options.k ?? DEFAULT_TOP_K);
    if (k === 0) return [];

    const queryNorm = norm(query);
    if (queryNorm === 0) return [];

    const exclude = new Set(options.excludeChunkIds ?? []);
    const seen = new Set<string>();
    const results: SimilarityResult[] = [];

    const candidates: IndexedVector[] = this.store.candidates(options.model, options.documentId);
    for (const candidate of candidates) {
      if (exclude.has(candidate.chunkId) || seen.has(candidate.chunkId)) continue;
      if (candidate.dimensions !== query.length || candidate.norm === 0) continue;

      const score = dot(query, candidate.vector) / (queryNorm * candidate.norm);
      if (options.minScore !== undefined && score < options.minScore) continue;

      seen.add(candidate.chunkId);
      results.push({
        chunkId: candidate.chunkId,
        documentId: candidate.documentId,
        model: candidate.model,
        dimensions: candidate.dimensions,
        score,
      });
    }

    results.sort((a, b) => b.score - a.score);
    log.info("vector search", {
      candidates: candidates.length,
      returned: Math.min(k, results.length),
      documentId: options.documentId,
    });
    return results.slice(0, k);
  }
}
