import {
  DOCUMENT_CHANNELS,
  type DocumentChunk,
  type DocResult,
  DocumentError,
  type DocumentRecord,
  type ProcessDocumentInput,
  type RetrievedChunk,
  type RetrieveQuery,
  type VisionAnalysis,
  isDocumentKind,
} from "../../shared/documents";
import { PersistenceError } from "../../shared/conversations";
import type { FileRecord } from "../../shared/files";
import { createLogger } from "../../shared/logger";
import { DocumentRepository } from "../documents/document.repository";
import { OCRService } from "../documents/ocr/ocr.service";
import { buildDocument } from "../documents/pipeline";
import { RetrieverService } from "../documents/retrieval/retriever.service";
import { VisionService } from "../documents/vision/vision.service";
import { FileRepository } from "../files/file.repository";
import { resolveStorage } from "../files/workspace";
import type { WebContents } from "electron";

/**
 * # Documents controller (main process)
 *
 * Orchestrates the Document Intelligence pipeline and the store. It never
 * throws across IPC — every call returns a `DocResult`. Processing is
 * idempotent: an already-parsed file returns its existing document unless
 * `force` is set. Parse/normalize failures are recorded as a `failed`
 * document (not lost) so the UI can surface them.
 */

const log = createLogger("main:documents");

function run<T>(operation: string, fn: () => T | Promise<T>): Promise<DocResult<T>> {
  return Promise.resolve()
    .then(fn)
    .then((data) => ({ ok: true as const, data }))
    .catch((error) => {
      const code =
        error instanceof DocumentError
          ? error.code
          : error instanceof PersistenceError
            ? "db-unavailable"
            : "unknown";
      const message = error instanceof Error ? error.message : String(error);
      log.warn("document operation failed", { operation, code, message });
      return { ok: false as const, code, message };
    });
}

/** Builds the `failed` record persisted when parsing/normalization fails. */
function failedRecord(file: FileRecord, error: DocumentError): DocumentRecord {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    sourceFileId: file.id,
    title: file.filename.replace(/\.[^.]+$/, "") || file.filename,
    kind: isDocumentKind(file.type) ? file.type : "txt",
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
    error: error.message,
    createdAt: now,
    updatedAt: now,
  };
}

export class DocumentsController {
  private readonly documents = new DocumentRepository();
  private readonly files = new FileRepository();
  private readonly retriever = new RetrieverService();
  private readonly ocr = new OCRService();
  private readonly vision = new VisionService();

  /** Parse → normalize → chunk → store for one uploaded file. */
  process(input: ProcessDocumentInput): Promise<DocResult<DocumentRecord>> {
    return run("process", async () => {
      const file = this.files.get(input.sourceFileId);
      if (!file) throw new DocumentError("not-found", "That file no longer exists.");
      if (!isDocumentKind(file.type)) {
        throw new DocumentError("unsupported-kind", "Only PDF, DOCX, TXT, and Markdown files can be processed.");
      }

      if (!input.force) {
        const existing = this.documents.getByFileId(file.id);
        if (existing && existing.status === "ready") return existing;
      }

      const absPath = resolveStorage(file.storageLocation);
      try {
        const built = await buildDocument(file, absPath, input.chunkOptions);
        return this.documents.save(built.record, built.content, built.chunks);
      } catch (error) {
        // File exists but couldn't be parsed → persist a visible failure.
        if (
          error instanceof DocumentError &&
          (error.code === "empty-document" || error.code === "corrupt" || error.code === "too-large")
        ) {
          const record = failedRecord(file, error);
          this.documents.save(record, "", []);
          return record;
        }
        throw error;
      }
    });
  }

  /** The document for a source file id, or null. */
  get(sourceFileId: string): Promise<DocResult<DocumentRecord | null>> {
    return run("get", () => this.documents.getByFileId(sourceFileId) ?? null);
  }

  list(): Promise<DocResult<DocumentRecord[]>> {
    return run("list", () => this.documents.list());
  }

  chunks(documentId: string): Promise<DocResult<DocumentChunk[]>> {
    return run("chunks", () => this.documents.chunks(documentId));
  }

  remove(documentId: string): Promise<DocResult<null>> {
    return run("remove", () => {
      this.documents.delete(documentId);
      return null;
    });
  }

  /** Query → Top-K relevant chunks (used by document chat). */
  retrieve(input: RetrieveQuery): Promise<DocResult<RetrievedChunk[]>> {
    return run("retrieve", () =>
      this.retriever.retrieve(input.query, {
        k: input.k,
        documentId: input.documentId,
        minScore: input.minScore,
      }),
    );
  }

  /** OCR one image into a document, streaming progress to the sender. */
  ocrExtract(sender: WebContents, imageId: string): Promise<DocResult<DocumentRecord>> {
    return run("ocr-extract", () =>
      this.ocr.extractText(imageId, (progress) => {
        if (!sender.isDestroyed()) sender.send(DOCUMENT_CHANNELS.ocrProgress, progress);
      }),
    );
  }

  /** OCR several images (background), streaming progress to the sender. */
  ocrExtractBatch(sender: WebContents, imageIds: string[]): Promise<DocResult<DocumentRecord[]>> {
    return run("ocr-extract-batch", () =>
      this.ocr.extractBatch(imageIds, (progress) => {
        if (!sender.isDestroyed()) sender.send(DOCUMENT_CHANNELS.ocrProgress, progress);
      }),
    );
  }

  /** Analyze one image with the vision model, streaming progress. */
  visionAnalyze(sender: WebContents, imageId: string): Promise<DocResult<VisionAnalysis>> {
    return run("vision-analyze", () =>
      this.vision.analyzeImage(imageId, (progress) => {
        if (!sender.isDestroyed()) sender.send(DOCUMENT_CHANNELS.visionProgress, progress);
      }),
    );
  }

  /** Analyze several images (background), streaming progress. */
  visionAnalyzeBatch(sender: WebContents, imageIds: string[]): Promise<DocResult<VisionAnalysis[]>> {
    return run("vision-analyze-batch", () =>
      this.vision.analyzeBatch(imageIds, (progress) => {
        if (!sender.isDestroyed()) sender.send(DOCUMENT_CHANNELS.visionProgress, progress);
      }),
    );
  }

  /** The cached image analysis (or null). */
  visionGet(imageId: string): Promise<DocResult<VisionAnalysis | null>> {
    return run("vision-get", () => this.vision.getAnalysis(imageId));
  }
}
