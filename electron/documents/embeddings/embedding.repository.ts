import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { createLogger } from "../../../shared/logger";
import { getDb } from "../../backend/db/client";
import { chunkEmbeddings, documentChunks } from "../../backend/db/schema";
import type { EmbeddingRecord, PendingChunk } from "./types";

/** A stored embedding joined with its chunk's document id (for the vector store). */
export interface StoredEmbeddingRow {
  chunkId: string;
  documentId: string;
  model: string;
  dimensions: number;
  embedding: number[];
}

function parseVector(raw: string): number[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as number[]) : [];
  } catch {
    return [];
  }
}

/**
 * # Embedding repository (main process)
 *
 * The only module that touches the `chunk_embeddings` table. It also
 * answers the "which chunks still need embedding?" question via a left
 * join against `document_chunks`, so the service can skip work that is
 * already done. Vectors are stored as JSON text.
 */

const log = createLogger("main:embeddings:repo");

export class EmbeddingRepository {
  /**
   * Chunks that have no embedding for `model`, in stable order. Optionally
   * scoped to a single document.
   */
  pendingChunks(model: string, documentId?: string): PendingChunk[] {
    return getDb()
      .select({ id: documentChunks.id, text: documentChunks.text })
      .from(documentChunks)
      .leftJoin(
        chunkEmbeddings,
        and(eq(chunkEmbeddings.chunkId, documentChunks.id), eq(chunkEmbeddings.model, model)),
      )
      .where(
        and(
          isNull(chunkEmbeddings.id),
          documentId ? eq(documentChunks.documentId, documentId) : undefined,
        ),
      )
      .orderBy(documentChunks.position)
      .all();
  }

  /** Total chunks in scope (used to report how many were skipped). */
  countChunks(documentId?: string): number {
    const row = getDb()
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks)
      .where(documentId ? eq(documentChunks.documentId, documentId) : undefined)
      .get();
    return row?.count ?? 0;
  }

  hasEmbedding(chunkId: string, model: string): boolean {
    const row = getDb()
      .select({ id: chunkEmbeddings.id })
      .from(chunkEmbeddings)
      .where(and(eq(chunkEmbeddings.chunkId, chunkId), eq(chunkEmbeddings.model, model)))
      .get();
    return Boolean(row);
  }

  /** One stored embedding for a (chunk, model), or undefined. */
  get(chunkId: string, model: string): EmbeddingRecord | undefined {
    const row = getDb()
      .select()
      .from(chunkEmbeddings)
      .where(and(eq(chunkEmbeddings.chunkId, chunkId), eq(chunkEmbeddings.model, model)))
      .get();
    if (!row) return undefined;
    return {
      id: row.id,
      chunkId: row.chunkId,
      model: row.model,
      dimensions: row.dimensions,
      embedding: parseVector(row.embedding),
      createdAt: row.createdAt,
    };
  }

  /** The document a chunk belongs to (for cache bookkeeping). */
  documentIdForChunk(chunkId: string): string | undefined {
    const row = getDb()
      .select({ documentId: documentChunks.documentId })
      .from(documentChunks)
      .where(eq(documentChunks.id, chunkId))
      .get();
    return row?.documentId;
  }

  /**
   * All stored vectors for a model, joined with their document id, for
   * building the in-memory search index. Optionally scoped to a document.
   */
  listVectors(model: string, documentId?: string): StoredEmbeddingRow[] {
    const rows = getDb()
      .select({
        chunkId: chunkEmbeddings.chunkId,
        documentId: documentChunks.documentId,
        model: chunkEmbeddings.model,
        dimensions: chunkEmbeddings.dimensions,
        embedding: chunkEmbeddings.embedding,
      })
      .from(chunkEmbeddings)
      .innerJoin(documentChunks, eq(documentChunks.id, chunkEmbeddings.chunkId))
      .where(
        and(
          eq(chunkEmbeddings.model, model),
          documentId ? eq(documentChunks.documentId, documentId) : undefined,
        ),
      )
      .all();
    return rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      model: row.model,
      dimensions: row.dimensions,
      embedding: parseVector(row.embedding),
    }));
  }

  /** Insert-or-replace a single embedding (keyed by the unique (chunk, model)). */
  upsert(record: EmbeddingRecord): void {
    getDb()
      .insert(chunkEmbeddings)
      .values({
        id: record.id,
        chunkId: record.chunkId,
        model: record.model,
        dimensions: record.dimensions,
        embedding: JSON.stringify(record.embedding),
        createdAt: record.createdAt,
      })
      .onConflictDoUpdate({
        target: [chunkEmbeddings.chunkId, chunkEmbeddings.model],
        set: {
          dimensions: record.dimensions,
          embedding: JSON.stringify(record.embedding),
          createdAt: record.createdAt,
        },
      })
      .run();
  }

  /** Removes one embedding. */
  deleteByChunk(chunkId: string, model: string): void {
    getDb()
      .delete(chunkEmbeddings)
      .where(and(eq(chunkEmbeddings.chunkId, chunkId), eq(chunkEmbeddings.model, model)))
      .run();
  }

  /** Removes every embedding whose chunk belongs to `documentId`. Returns the count. */
  deleteByDocument(documentId: string, model: string): number {
    const chunkIds = getDb()
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId));
    const result = getDb()
      .delete(chunkEmbeddings)
      .where(and(eq(chunkEmbeddings.model, model), inArray(chunkEmbeddings.chunkId, chunkIds)))
      .run();
    return result.changes;
  }

  /** Inserts a batch of embeddings atomically. Ignores duplicates (unique index). */
  insertMany(records: EmbeddingRecord[]): void {
    if (records.length === 0) return;
    const db = getDb();
    db.transaction((tx) => {
      for (const record of records) {
        tx
          .insert(chunkEmbeddings)
          .values({
            id: record.id,
            chunkId: record.chunkId,
            model: record.model,
            dimensions: record.dimensions,
            embedding: JSON.stringify(record.embedding),
            createdAt: record.createdAt,
          })
          .onConflictDoNothing()
          .run();
      }
    });
    log.info("embeddings stored", { count: records.length, model: records[0]?.model });
  }
}
