import type { DocumentKind } from "@shared/documents";

import type { RetrievedContextChunk } from "@/ai/prompt/prompt-context";

/**
 * # Citation types (document chat)
 *
 * Shapes for grounding a chat answer in uploaded documents: the citations
 * shown under an assistant reply, the documents used to answer, and the
 * bundle the conversation manager consumes. This layer only assembles
 * citations + prompt context — it does not build prompts or call an LLM.
 */

/** A single citation for one retrieved chunk. */
export interface Citation {
  /** Stable id (the chunk id). */
  id: string;
  /** 1-based display number, e.g. [1]. */
  index: number;
  chunkId: string;
  documentId: string;
  /** FileRecord id of the source file — used to open the document. */
  sourceFileId: string;
  documentTitle: string;
  kind: DocumentKind;
  /** 1-based page, when known (for display / "jump to page"). */
  page?: number;
  /** Heading trail within the document, when known. */
  headingPath?: string[];
  /** Similarity score of the cited chunk. */
  score: number;
  /** Short preview of the cited text. */
  snippet: string;
}

/** A document that contributed at least one chunk to the answer. */
export interface DocumentUsed {
  documentId: string;
  sourceFileId: string;
  title: string;
  kind: DocumentKind;
  /** How many retrieved chunks came from this document. */
  chunkCount: number;
}

/**
 * The result of grounding one question: citations to show, documents
 * used, the context to inject into the prompt, and whether retrieval
 * found anything useful.
 */
export interface DocumentChatResult {
  citations: Citation[];
  documentsUsed: DocumentUsed[];
  context: RetrievedContextChunk[];
  /** True when retrieval returned no relevant chunks. */
  noResults: boolean;
}

/**
 * Port the conversation manager depends on to ground a turn in documents.
 * Implemented by `DocumentChatService`.
 */
export interface DocumentChatPort {
  answerWithDocuments(query: string, conversationId: string | null): Promise<DocumentChatResult>;
}
