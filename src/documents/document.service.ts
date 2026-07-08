import {
  type DocResult,
  type DocumentChunk,
  DocumentError,
  type DocumentRecord,
  type OcrProgress,
  type ProcessDocumentInput,
  type RetrievedChunk,
  type RetrieveQuery,
  type VisionAnalysis,
  type VisionProgress,
} from "@shared/documents";
import type { LunaDocumentsApi } from "@/types/electron";

/**
 * # Document service (renderer)
 *
 * The only module that talks to the documents IPC bridge. Unwraps
 * `DocResult` envelopes into values or thrown `DocumentError`s so the
 * store can use ordinary try/catch. Components never touch `window.luna`.
 */

function bridge(): LunaDocumentsApi {
  const api = window.luna?.documents;
  if (!api) {
    throw new DocumentError(
      "unknown",
      "The document bridge is unavailable. Launch Luna through Electron.",
    );
  }
  return api;
}

function unwrap<T>(result: DocResult<T>): T {
  if (result.ok) return result.data;
  throw new DocumentError(result.code, result.message);
}

export const documentService = {
  /** Parse + index a source file into a structured document. */
  async process(input: ProcessDocumentInput): Promise<DocumentRecord> {
    return unwrap(await bridge().process(input));
  },

  async get(sourceFileId: string): Promise<DocumentRecord | null> {
    return unwrap(await bridge().get(sourceFileId));
  },

  async list(): Promise<DocumentRecord[]> {
    return unwrap(await bridge().list());
  },

  async chunks(documentId: string): Promise<DocumentChunk[]> {
    return unwrap(await bridge().chunks(documentId));
  },

  async remove(documentId: string): Promise<void> {
    unwrap(await bridge().remove(documentId));
  },

  /** Query → Top-K relevant chunks (for document chat). */
  async retrieve(input: RetrieveQuery): Promise<RetrievedChunk[]> {
    return unwrap(await bridge().retrieve(input));
  },

  /** OCR one image into a document linked to it. */
  async ocrExtract(imageId: string): Promise<DocumentRecord> {
    return unwrap(await bridge().ocrExtract(imageId));
  },

  /** OCR several images in the background. */
  async ocrExtractBatch(imageIds: string[]): Promise<DocumentRecord[]> {
    return unwrap(await bridge().ocrExtractBatch(imageIds));
  },

  /** Subscribes to OCR progress events. Returns an unsubscribe function. */
  onOcrProgress(callback: (progress: OcrProgress) => void): () => void {
    return window.luna?.documents.onOcrProgress(callback) ?? (() => {});
  },

  /** Analyze one image with the vision model (background). */
  async visionAnalyze(imageId: string): Promise<VisionAnalysis> {
    return unwrap(await bridge().visionAnalyze(imageId));
  },

  /** Analyze several images with the vision model. */
  async visionAnalyzeBatch(imageIds: string[]): Promise<VisionAnalysis[]> {
    return unwrap(await bridge().visionAnalyzeBatch(imageIds));
  },

  /** Fetch a cached image analysis (or null). */
  async visionGet(imageId: string): Promise<VisionAnalysis | null> {
    return unwrap(await bridge().visionGet(imageId));
  },

  /** Subscribes to vision progress events. Returns an unsubscribe function. */
  onVisionProgress(callback: (progress: VisionProgress) => void): () => void {
    return window.luna?.documents.onVisionProgress(callback) ?? (() => {});
  },
};
