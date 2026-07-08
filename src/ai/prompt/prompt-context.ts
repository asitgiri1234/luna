/**
 * # Prompt context types (RAG augmentation)
 *
 * The shapes the `PromptBuilder` / `ContextFormatter` consume to inject
 * retrieved document context into a prompt. These mirror what the
 * main-process `RetrieverService` returns, projected to just what the
 * prompt needs (text + a display label + optional locators). This layer
 * only formats context — it does not retrieve, embed, or call an LLM.
 */

/** One retrieved chunk, ready to be rendered into the prompt. */
export interface RetrievedContextChunk {
  /** Stable id, used to de-duplicate. */
  chunkId: string;
  text: string;
  /** Display label for the source, e.g. "Resume.pdf" or "Notes.md". */
  documentTitle: string;
  /** 1-based source page, when known. */
  page?: number;
  /** Heading trail within the document, when known. */
  headingPath?: string[];
  /** Original order within its document (for stable ordering). */
  position?: number;
  /** Similarity score from retrieval (not shown to the model). */
  score?: number;
}

/** Caps on how much retrieved context may be injected. */
export interface ContextLimits {
  /** Maximum characters of injected document context. */
  maxChars: number;
  /** Optional cap on the number of chunks. */
  maxChunks?: number;
}

/** Configurable default budget for injected context. */
export const DEFAULT_CONTEXT_LIMITS: ContextLimits = {
  maxChars: 6000,
  maxChunks: 8,
};
