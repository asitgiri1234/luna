import type { VisionAnalysis } from "@shared/documents";
import type { FileRecord } from "@shared/files";
import type { Logger } from "@shared/logger";

import type { RetrievedContextChunk } from "@/ai/prompt/prompt-context";

import type {
  ImageChatPort,
  ImageChatResult,
  ImageContext,
} from "./image-chat.types";

/**
 * # ImageChatService
 *
 * Lets the user ask (and follow up) about an uploaded image. It reads the
 * image's cached vision analysis, formats it (plus light file metadata)
 * into prompt context, and hands it to the conversation manager, which
 * streams the answer exactly like normal chat. The "current image" is
 * remembered so follow-up questions need no re-selection.
 *
 * It performs NO vision inference — if an image has no analysis yet, the
 * context is empty and the turn is flagged "no analysis available". Built
 * contexts are cached per image to avoid repeated processing.
 */
export class ImageChatService implements ImageChatPort {
  private currentImageId: string | null = null;
  private readonly cache = new Map<string, ImageContext>();

  constructor(
    private readonly getVision: (imageId: string) => Promise<VisionAnalysis | null>,
    private readonly getFile: (imageId: string) => Promise<FileRecord | null>,
    private readonly logger: Logger,
  ) {}

  /** Grounds a turn in `imageId` and remembers it for follow-ups. */
  async answerAboutImage(imageId: string, _question: string): Promise<ImageChatResult> {
    this.currentImageId = imageId;
    const context = await this.buildImageContext(imageId);
    this.logger.debug("image chat context", {
      imageId,
      hasAnalysis: context.hasAnalysis,
    });
    return {
      imageId,
      filename: context.filename,
      hasAnalysis: context.hasAnalysis,
      context: context.context,
    };
  }

  /** Builds (and caches) the prompt context for one image. */
  async buildImageContext(imageId: string): Promise<ImageContext> {
    const cached = this.cache.get(imageId);
    if (cached) return cached;

    const [analysis, file] = await Promise.all([
      this.getVision(imageId).catch(() => null),
      this.getFile(imageId).catch(() => null),
    ]);

    const filename = file?.filename ?? "image";
    const kind = file?.type ?? "image";
    const hasAnalysis = analysis !== null;
    const context: RetrievedContextChunk[] = analysis
      ? [{ chunkId: `vision:${imageId}`, text: this.describe(filename, kind, file, analysis), documentTitle: filename }]
      : [];

    const built: ImageContext = { imageId, filename, kind, hasAnalysis, analysis, context };
    this.cache.set(imageId, built);
    return built;
  }

  /** The context for the image currently being discussed (or null). */
  getCurrentImageContext(): ImageContext | null {
    return this.currentImageId ? (this.cache.get(this.currentImageId) ?? null) : null;
  }

  getCurrentImageId(): string | null {
    return this.currentImageId;
  }

  /** Clears the current image (e.g. on a new chat). */
  clear(): void {
    this.currentImageId = null;
  }

  /** Drops a cached context (e.g. after the image is re-analyzed). */
  invalidate(imageId: string): void {
    this.cache.delete(imageId);
  }

  /** Formats the analysis + light metadata as the injected context text. */
  private describe(
    filename: string,
    kind: string,
    file: FileRecord | null,
    analysis: VisionAnalysis,
  ): string {
    const meta = file ? `${kind.toUpperCase()}, ${formatBytes(file.size)}` : kind;
    return [
      `Image file: ${filename} (${meta})`,
      `Caption: ${analysis.caption}`,
      `Description: ${analysis.description}`,
      analysis.objects.length > 0 ? `Objects: ${analysis.objects.join(", ")}` : "",
      analysis.sceneSummary ? `Scene: ${analysis.sceneSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
