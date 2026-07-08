import { randomUUID } from "node:crypto";

import {
  type ChunkOptions,
  DEFAULT_CHUNK_OPTIONS,
  type DocumentChunk,
  type DocumentKind,
  DocumentError,
  type DocumentRecord,
  MAX_DOCUMENT_CHARS,
  PREVIEW_CHARS,
  isDocumentKind,
} from "../../shared/documents";
import type { FileRecord } from "../../shared/files";
import { createLogger } from "../../shared/logger";
import { chunkDocument } from "./chunking";
import { prepareChunks } from "./indexing";
import { extractMetadata } from "./metadata";
import { normalizeDocument } from "./normalizers";
import { parseDocument } from "./parsers";
import type { ParsedDocument } from "./types";

/**
 * # Document pipeline (main process)
 *
 * The composition of the stages, in order:
 *
 *   parse → normalize → metadata → chunk → index-prep
 *
 * Produces a `DocumentRecord`, the full normalized `content` (persisted
 * for future re-chunking / embedding), and ordered `DocumentChunk`s.
 * Purely CPU + text work: no network, no LLM, no embeddings.
 */

const log = createLogger("main:documents:pipeline");

export interface BuiltDocument {
  record: DocumentRecord;
  /** Full normalized text — stored in `documents.content`. */
  content: string;
  chunks: DocumentChunk[];
}

export async function buildDocument(
  file: FileRecord,
  absPath: string,
  chunkOptions?: Partial<ChunkOptions>,
): Promise<BuiltDocument> {
  if (!isDocumentKind(file.type)) {
    throw new DocumentError("unsupported-kind", `"${file.type}" is not a text document.`);
  }
  // 1. Parse → raw per-page text + container metadata.
  const parsed = await parseDocument(file.type, absPath);
  // 2–5. Normalize → metadata → chunk → index-prep.
  return assembleDocument(file, parsed, file.type, chunkOptions);
}

/**
 * The post-parse pipeline (normalize → metadata → chunk → index-prep),
 * reused by any source of raw text — file parsers *and* OCR. `kind` is
 * the document kind to record (OCR stores its extracted text as `txt`).
 */
export function assembleDocument(
  file: FileRecord,
  parsed: ParsedDocument,
  kind: DocumentKind,
  chunkOptions?: Partial<ChunkOptions>,
): BuiltDocument {
  // Normalize → clean text + structural blocks.
  const normalized = normalizeDocument(parsed);
  if (!normalized.content.trim()) {
    throw new DocumentError(
      "empty-document",
      "No readable text was found (a scanned or image-only file has no extractable text).",
    );
  }
  if (normalized.content.length > MAX_DOCUMENT_CHARS) {
    throw new DocumentError("too-large", "This document's text is too large to process.");
  }

  // Metadata → title, author, counts, language, reading time.
  const metrics = extractMetadata(parsed, normalized, file);

  // Chunk → index-prep (assign id / documentId / order).
  const documentId = randomUUID();
  const options: ChunkOptions = { ...DEFAULT_CHUNK_OPTIONS, ...chunkOptions };
  const drafts = chunkDocument(normalized.blocks, options);
  const chunks: DocumentChunk[] = prepareChunks(documentId, drafts);

  const now = Date.now();
  const record: DocumentRecord = {
    id: documentId,
    sourceFileId: file.id,
    title: metrics.title,
    kind,
    language: metrics.language,
    wordCount: metrics.wordCount,
    pageCount: metrics.pageCount,
    paragraphCount: metrics.paragraphCount,
    readingTimeMinutes: metrics.readingTimeMinutes,
    author: metrics.author,
    documentCreatedAt: metrics.documentCreatedAt,
    chunkCount: chunks.length,
    preview: normalized.content.slice(0, PREVIEW_CHARS),
    status: "ready",
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  log.info("document built", {
    id: documentId,
    kind,
    pages: metrics.pageCount,
    words: metrics.wordCount,
    chunks: chunks.length,
    strategy: options.strategy,
  });

  return { record, content: normalized.content, chunks };
}
