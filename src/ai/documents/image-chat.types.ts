import type { VisionAnalysis } from "@shared/documents";

import type { RetrievedContextChunk } from "@/ai/prompt/prompt-context";

/**
 * # Image chat types
 *
 * Shapes for grounding a chat turn in an uploaded image's *already
 * computed* vision analysis (caption / description / objects / scene). No
 * new vision inference happens here — the analysis is read from the cache
 * the VisionService produced. The image's textual context is injected via
 * the same `RetrievedContextChunk` the PromptManager already consumes.
 */

/** The prepared context for chatting about one image. */
export interface ImageContext {
  imageId: string;
  filename: string;
  /** File kind (png / jpeg / webp). */
  kind: string;
  /** False when the image hasn't been analyzed yet. */
  hasAnalysis: boolean;
  analysis: VisionAnalysis | null;
  /** Prompt context chunks (empty when there is no analysis). */
  context: RetrievedContextChunk[];
}

/** Returned to the conversation manager for one image-grounded turn. */
export interface ImageChatResult {
  imageId: string;
  filename: string;
  hasAnalysis: boolean;
  context: RetrievedContextChunk[];
}

/**
 * Port the conversation manager depends on to ground a turn in an image.
 * Implemented by `ImageChatService`.
 */
export interface ImageChatPort {
  answerAboutImage(imageId: string, question: string): Promise<ImageChatResult>;
  getCurrentImageId(): string | null;
}

/** Attached to an assistant message answered about an image. */
export interface MessageImageContext {
  imageId: string;
  filename: string;
  /** False → the UI shows "No analysis available". */
  hasAnalysis: boolean;
}
