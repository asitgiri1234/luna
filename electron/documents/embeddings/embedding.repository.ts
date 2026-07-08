import { and, eq, isNull, sql } from "drizzle-orm";

import { createLogger } from "../../../shared/logger";
import { getDb } from "../../backend/db/client";
import { chunkEmbeddings, documentChunks } from "../../backend/db/schema";
import type { EmbeddingRecord, PendingChunk } from "./types";

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
