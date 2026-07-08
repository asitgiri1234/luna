import { createLogger } from "../../../shared/logger";
import { defaultEmbeddingConfig } from "./embedding.config";
import { EmbeddingRepository } from "./embedding.repository";
import type { EmbeddingRecord } from "./types";
import type { IndexedVector, StoredVector } from "./vector.types";

/**
 * # VectorStore (main process)
 *
 * Stores and retrieves chunk vectors efficiently. It is the durable home
 * of embeddings (via `EmbeddingRepository` → `chunk_embeddings`) plus an
 * in-memory index (per model) of `Float32Array` vectors with precomputed
 * L2 norms, so repeated similarity search never re-reads or re-parses the
 * database.
 *
 * Storage only — the cosine / Top-K math lives in `VectorSearchService`.
 */

const log = createLogger("main:vectors:store");

/** L2 norm of a vector (0 for an empty/zero vector). */
function l2Norm(vector: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  return Math.sqrt(sum);
}

export class VectorStore {
  private readonly model: string;
  private readonly repository: EmbeddingRepository;
  /** model → (chunkId → indexed vector). Lazily populated per model. */
  private readonly index = new Map<string, Map<string, IndexedVector>>();

  constructor(model: string = defaultEmbeddingConfig.model, repository = new EmbeddingRepository()) {
    this.model = model;
    this.repository = repository;
  }

  /** Insert-or-replace a chunk's embedding (DB + in-memory index). */
  upsertEmbedding(record: EmbeddingRecord, model: string = record.model || this.model): void {
    const toStore: EmbeddingRecord = { ...record, model };
    this.repository.upsert(toStore);

    const bucket = this.index.get(model);
    if (bucket) {
      const documentId = this.repository.documentIdForChunk(record.chunkId);
      if (documentId) bucket.set(record.chunkId, this.toIndexed(record.chunkId, documentId, model, record.embedding));
    }
  }

  /** The stored embedding for a chunk, or null. */
  getEmbedding(chunkId: string, model: string = this.model): EmbeddingRecord | null {
    return this.repository.get(chunkId, model) ?? null;
  }

  /** Remove one chunk's embedding (DB + index). */
  deleteEmbedding(chunkId: string, model: string = this.model): void {
    this.repository.deleteByChunk(chunkId, model);
    this.index.get(model)?.delete(chunkId);
  }

  /** Remove all embeddings for a document. Returns how many were removed. */
  deleteDocumentEmbeddings(documentId: string, model: string = this.model): number {
    const removed = this.repository.deleteByDocument(documentId, model);
    const bucket = this.index.get(model);
    if (bucket) {
      for (const [chunkId, vector] of bucket) {
        if (vector.documentId === documentId) bucket.delete(chunkId);
      }
    }
    return removed;
  }

  /**
   * Indexed candidate vectors for search (from the in-memory index),
   * optionally scoped to a document. Consumed by `VectorSearchService`.
   */
  candidates(model: string = this.model, documentId?: string): IndexedVector[] {
    const bucket = this.ensureLoaded(model);
    const all = [...bucket.values()];
    return documentId ? all.filter((vector) => vector.documentId === documentId) : all;
  }

  /** Plain view of stored vectors (numbers), e.g. for inspection/export. */
  vectors(model: string = this.model, documentId?: string): StoredVector[] {
    return this.candidates(model, documentId).map((vector) => ({
      chunkId: vector.chunkId,
      documentId: vector.documentId,
      model: vector.model,
      dimensions: vector.dimensions,
      vector: Array.from(vector.vector),
    }));
  }

  /** Drops the in-memory index (forces a fresh load on next search). */
  reload(model?: string): void {
    if (model) this.index.delete(model);
    else this.index.clear();
  }

  private ensureLoaded(model: string): Map<string, IndexedVector> {
    const existing = this.index.get(model);
    if (existing) return existing;

    const bucket = new Map<string, IndexedVector>();
    for (const row of this.repository.listVectors(model)) {
      bucket.set(row.chunkId, this.toIndexed(row.chunkId, row.documentId, model, row.embedding));
    }
    this.index.set(model, bucket);
    log.info("vector index loaded", { model, count: bucket.size });
    return bucket;
  }

  private toIndexed(
    chunkId: string,
    documentId: string,
    model: string,
    embedding: number[],
  ): IndexedVector {
    const vector = Float32Array.from(embedding);
    return { chunkId, documentId, model, dimensions: vector.length, vector, norm: l2Norm(vector) };
  }
}
