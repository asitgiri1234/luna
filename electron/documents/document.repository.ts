import { asc, desc, eq, inArray } from "drizzle-orm";

import {
  type ChunkMetadata,
  type DocumentChunk,
  type DocumentKind,
  type DocumentRecord,
  type DocumentStatus,
  PREVIEW_CHARS,
} from "../../shared/documents";
import { createLogger } from "../../shared/logger";
import { getDb } from "../backend/db/client";
import { documentChunks, documents } from "../backend/db/schema";

/**
 * # Document repository (main process)
 *
 * The only module that touches the `documents` / `document_chunks`
 * tables. Persisting a document replaces any prior version for the same
 * source file in a single transaction (document + its chunks), so a
 * re-process never leaves orphans. Speaks in `DocumentRecord` /
 * `DocumentChunk` DTOs; `content` is stored but never shipped whole.
 */

const log = createLogger("main:documents:repo");

type DocumentRow = typeof documents.$inferSelect;

/** Maps a stored row to the wire record (deriving `preview` from content). */
function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    sourceFileId: row.sourceFileId,
    title: row.title,
    kind: row.kind as DocumentKind,
    language: row.language,
    wordCount: row.wordCount,
    pageCount: row.pageCount,
    paragraphCount: row.paragraphCount,
    readingTimeMinutes: row.readingTimeMinutes,
    author: row.author ?? null,
    documentCreatedAt: row.documentCreatedAt ?? null,
    chunkCount: row.chunkCount,
    preview: (row.content ?? "").slice(0, PREVIEW_CHARS),
    status: row.status as DocumentStatus,
    error: row.error ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DocumentRepository {
  /**
   * Replaces any existing document for `record.sourceFileId` with this
   * one plus its chunks, atomically. A failed document persists with
   * empty content and no chunks so the UI can show the failure.
   */
  save(record: DocumentRecord, content: string, chunks: DocumentChunk[]): DocumentRecord {
    const db = getDb();
    db.transaction((tx) => {
      // Cascade removes chunks of any prior document for this source file.
      tx.delete(documents).where(eq(documents.sourceFileId, record.sourceFileId)).run();
      tx
        .insert(documents)
        .values({
          id: record.id,
          sourceFileId: record.sourceFileId,
          title: record.title,
          kind: record.kind,
          content,
          language: record.language,
          wordCount: record.wordCount,
          pageCount: record.pageCount,
          paragraphCount: record.paragraphCount,
          readingTimeMinutes: record.readingTimeMinutes,
          author: record.author,
          documentCreatedAt: record.documentCreatedAt,
          chunkCount: record.chunkCount,
          status: record.status,
          error: record.error,
          metadata: null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .run();
      for (const chunk of chunks) {
        tx
          .insert(documentChunks)
          .values({
            id: chunk.id,
            documentId: chunk.documentId,
            position: chunk.position,
            text: chunk.text,
            metadata: JSON.stringify(chunk.metadata),
            createdAt: record.createdAt,
          })
          .run();
      }
    });
    log.info("document saved", { id: record.id, status: record.status, chunks: chunks.length });
    return record;
  }

  getByFileId(sourceFileId: string): DocumentRecord | undefined {
    const row = getDb()
      .select()
      .from(documents)
      .where(eq(documents.sourceFileId, sourceFileId))
      .get();
    return row ? toRecord(row) : undefined;
  }

  getById(id: string): DocumentRecord | undefined {
    const row = getDb().select().from(documents).where(eq(documents.id, id)).get();
    return row ? toRecord(row) : undefined;
  }

  list(): DocumentRecord[] {
    return getDb()
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .all()
      .map(toRecord);
  }

  chunks(documentId: string): DocumentChunk[] {
    const rows = getDb()
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(asc(documentChunks.position))
      .all();
    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      position: row.position,
      text: row.text,
      metadata: safeMetadata(row.metadata),
    }));
  }

  /** Chunks for an arbitrary set of ids (unordered), for retrieval hydration. */
  chunksByIds(ids: string[]): DocumentChunk[] {
    if (ids.length === 0) return [];
    const rows = getDb().select().from(documentChunks).where(inArray(documentChunks.id, ids)).all();
    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      position: row.position,
      text: row.text,
      metadata: safeMetadata(row.metadata),
    }));
  }

  delete(id: string): void {
    // Chunks cascade via the foreign key.
    getDb().delete(documents).where(eq(documents.id, id)).run();
  }
}

/** Tolerates a corrupt metadata cell without failing the whole query. */
function safeMetadata(raw: string | null): ChunkMetadata {
  if (!raw) return { wordCount: 0, charCount: 0, strategy: "sentence" };
  try {
    return JSON.parse(raw) as ChunkMetadata;
  } catch {
    return { wordCount: 0, charCount: 0, strategy: "sentence" };
  }
}
