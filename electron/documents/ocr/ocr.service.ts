import { randomUUID } from "node:crypto";

import { DocumentError, type DocumentRecord, type OcrProgress } from "../../../shared/documents";
import { type FileRecord, isImageKind } from "../../../shared/files";
import { PersistenceError } from "../../../shared/conversations";
import { createLogger } from "../../../shared/logger";
import { FileRepository } from "../../files/file.repository";
import { resolveStorage } from "../../files/workspace";
import { DocumentRepository } from "../document.repository";
import { assembleDocument } from "../pipeline";
import type { ParsedDocument } from "../types";
import type { OcrEngine } from "./ocr.types";
import { TesseractEngine } from "./tesseract-engine";

/**
 * # OCRService (main process)
 *
 * Extracts text from PNG / JPG / JPEG / WEBP images and saves it as a
 * normal `documents` row linked to the source image (reusing the whole
 * document schema + pipeline: normalize → metadata → chunk → store). So
 * OCR'd images become searchable / chattable through the existing stack —
 * no OCR-specific table.
 *
 * OCR runs off the caller's stack (the controller invokes it without
 * blocking the UI) and streams progress. Corrupt / unsupported / blank
 * images degrade to a `failed` document with a clear reason.
 *
 * This is text recognition only — no vision model, image chat, or object
 * detection.
 */

const log = createLogger("main:ocr");

export type OcrProgressListener = (progress: OcrProgress) => void;

export class OCRService {
  private readonly engine: OcrEngine;
  private readonly files: FileRepository;
  private readonly documents: DocumentRepository;

  constructor(
    engine: OcrEngine = new TesseractEngine(),
    files: FileRepository = new FileRepository(),
    documents: DocumentRepository = new DocumentRepository(),
  ) {
    this.engine = engine;
    this.files = files;
    this.documents = documents;
  }

  /**
   * OCRs one image into a document. Idempotent: an image already OCR'd
   * (ready) is returned as-is unless `force`. Failures are recorded as a
   * `failed` document so the UI can surface them.
   */
  async extractText(
    imageId: string,
    onProgress?: OcrProgressListener,
    force = false,
  ): Promise<DocumentRecord> {
    const file = this.files.get(imageId);
    if (!file) throw new DocumentError("not-found", "That image no longer exists.");
    if (!isImageKind(file.type)) {
      throw new DocumentError(
        "unsupported-kind",
        "OCR only supports PNG, JPG, JPEG, and WEBP images.",
      );
    }

    if (!force) {
      const existing = this.documents.getByFileId(imageId);
      if (existing && existing.status === "ready") {
        onProgress?.({ imageId, status: "done", progress: 1 });
        return existing;
      }
    }

    const absPath = resolveStorage(file.storageLocation);
    onProgress?.({ imageId, status: "queued", progress: 0 });

    let text: string;
    try {
      text = await this.engine.recognize(absPath, (status, progress) =>
        onProgress?.({ imageId, status, progress }),
      );
    } catch (error) {
      const record = this.failedRecord(
        file,
        "This image could not be read for OCR — it may be corrupted or unsupported.",
      );
      this.documents.save(record, "", []);
      onProgress?.({ imageId, status: "failed", progress: 1 });
      log.warn("ocr failed", { imageId, message: String(error) });
      return record;
    }

    const parsed: ParsedDocument = {
      pages: [{ page: 1, text }],
      meta: { pageCount: 1 },
      isMarkdown: false,
    };

    try {
      const built = assembleDocument(file, parsed, "txt");
      const saved = this.documents.save(built.record, built.content, built.chunks);
      onProgress?.({ imageId, status: "done", progress: 1 });
      log.info("ocr complete", { imageId, words: saved.wordCount, chunks: saved.chunkCount });
      return saved;
    } catch (error) {
      if (error instanceof DocumentError && error.code === "empty-document") {
        const record = this.failedRecord(file, "No text was found in this image.");
        this.documents.save(record, "", []);
        onProgress?.({ imageId, status: "done", progress: 1 });
        return record;
      }
      if (error instanceof PersistenceError) throw error;
      throw error;
    }
  }

  /** OCRs several images sequentially (background); per-image failures are skipped. */
  async extractBatch(
    imageIds: string[],
    onProgress?: OcrProgressListener,
  ): Promise<DocumentRecord[]> {
    const results: DocumentRecord[] = [];
    for (const imageId of imageIds) {
      try {
        results.push(await this.extractText(imageId, onProgress));
      } catch (error) {
        log.warn("batch ocr item failed", { imageId, message: String(error) });
      }
    }
    return results;
  }

  /** The OCR document for an image (or null) — reuses the documents table. */
  getOCRResult(imageId: string): DocumentRecord | null {
    return this.documents.getByFileId(imageId) ?? null;
  }

  dispose(): Promise<void> {
    return this.engine.dispose();
  }

  private failedRecord(file: FileRecord, message: string): DocumentRecord {
    const now = Date.now();
    return {
      id: randomUUID(),
      sourceFileId: file.id,
      title: file.filename.replace(/\.[^.]+$/, "") || file.filename,
      kind: "txt",
      language: "und",
      wordCount: 0,
      pageCount: 0,
      paragraphCount: 0,
      readingTimeMinutes: 0,
      author: null,
      documentCreatedAt: null,
      chunkCount: 0,
      preview: "",
      status: "failed",
      error: message,
      createdAt: now,
      updatedAt: now,
    };
  }
}
