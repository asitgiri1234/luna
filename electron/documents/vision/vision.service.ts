import { randomUUID } from "node:crypto";

import {
  DocumentError,
  type DocumentRecord,
  type VisionAnalysis,
  type VisionProgress,
} from "../../../shared/documents";
import { type FileRecord, isImageKind } from "../../../shared/files";
import { createLogger } from "../../../shared/logger";
import { FileRepository } from "../../files/file.repository";
import { resolveStorage } from "../../files/workspace";
import { DocumentRepository } from "../document.repository";
import { OllamaVisionEngine } from "./ollama-vision-engine";
import { type VisionConfig, defaultVisionConfig } from "./vision.config";
import type { VisionEngine } from "./vision.types";

/**
 * # VisionService (main process)
 *
 * Understands an image with a local vision-capable model (via Ollama):
 * caption, description, objects, and a scene summary. Results are saved
 * on the image's document row (`documents.metadata` JSON) so they're
 * linked to the existing document/image record — no new schema.
 *
 * Analysis runs off the caller's stack (the controller invokes it without
 * blocking the UI) and streams progress. Generated descriptions are
 * cached (keyed by image + model) so the same image isn't re-analyzed.
 *
 * Image understanding only — no image chat, OCR, or object detection.
 */

const log = createLogger("main:vision");

export type VisionProgressListener = (progress: VisionProgress) => void;

/** The shape stored under `documents.metadata` (alongside any other keys). */
interface DocumentMetadata {
  vision?: VisionAnalysis;
  [key: string]: unknown;
}

export class VisionService {
  private readonly config: VisionConfig;
  private readonly engine: VisionEngine;
  private readonly files: FileRepository;
  private readonly documents: DocumentRepository;

  constructor(
    config: Partial<VisionConfig> = {},
    engine?: VisionEngine,
    files: FileRepository = new FileRepository(),
    documents: DocumentRepository = new DocumentRepository(),
  ) {
    this.config = { ...defaultVisionConfig, ...config };
    this.engine = engine ?? new OllamaVisionEngine(this.config);
    this.files = files;
    this.documents = documents;
  }

  /**
   * Analyzes one image and stores the result on its document. Cached: an
   * image already analyzed with the same model is returned as-is unless
   * `force`.
   */
  async analyzeImage(
    imageId: string,
    onProgress?: VisionProgressListener,
    force = false,
  ): Promise<VisionAnalysis> {
    const file = this.files.get(imageId);
    if (!file) throw new DocumentError("not-found", "That image no longer exists.");
    if (!isImageKind(file.type)) {
      throw new DocumentError("unsupported-kind", "Vision analysis only supports image files.");
    }

    if (!force) {
      const cached = this.getAnalysis(imageId);
      if (cached && cached.model === this.config.model) {
        onProgress?.({ imageId, status: "done", progress: 1 });
        return cached;
      }
    }

    onProgress?.({ imageId, status: "queued", progress: 0 });
    const absPath = resolveStorage(file.storageLocation);

    const data = await this.engine.analyze(absPath, this.config.model, (status, progress) =>
      onProgress?.({ imageId, status, progress }),
    );

    const analysis: VisionAnalysis = {
      caption: data.caption,
      description: data.description,
      objects: data.objects,
      sceneSummary: data.sceneSummary,
      model: this.config.model,
      createdAt: Date.now(),
    };
    this.store(file, analysis);
    log.info("vision stored", { imageId, model: analysis.model, objects: analysis.objects.length });
    return analysis;
  }

  /** Analyzes several images sequentially in the background. */
  async analyzeBatch(
    imageIds: string[],
    onProgress?: VisionProgressListener,
  ): Promise<VisionAnalysis[]> {
    const results: VisionAnalysis[] = [];
    for (const imageId of imageIds) {
      try {
        results.push(await this.analyzeImage(imageId, onProgress));
      } catch (error) {
        onProgress?.({ imageId, status: "failed", progress: 1 });
        log.warn("batch vision item failed", { imageId, message: String(error) });
      }
    }
    return results;
  }

  /** The cached analysis for an image (from its document metadata), or null. */
  getAnalysis(imageId: string): VisionAnalysis | null {
    const found = this.documents.metadataByFileId(imageId);
    if (!found?.metadata) return null;
    try {
      const meta = JSON.parse(found.metadata) as DocumentMetadata;
      return meta.vision ?? null;
    } catch {
      return null;
    }
  }

  /** Writes the analysis into the image's document metadata (augment or create). */
  private store(file: FileRecord, analysis: VisionAnalysis): void {
    const existing = this.documents.metadataByFileId(file.id);
    if (existing) {
      const meta = this.mergeMetadata(existing.metadata, analysis);
      this.documents.setMetadata(existing.documentId, JSON.stringify(meta));
      return;
    }
    // No document yet (e.g. OCR never ran): create a minimal one to hold it.
    const now = Date.now();
    const record: DocumentRecord = {
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
      preview: analysis.caption,
      status: "ready",
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.save(record, analysis.description, []);
    this.documents.setMetadata(record.id, JSON.stringify({ vision: analysis } satisfies DocumentMetadata));
  }

  private mergeMetadata(raw: string | null, analysis: VisionAnalysis): DocumentMetadata {
    let meta: DocumentMetadata = {};
    if (raw) {
      try {
        meta = JSON.parse(raw) as DocumentMetadata;
      } catch {
        meta = {};
      }
    }
    meta.vision = analysis;
    return meta;
  }
}
