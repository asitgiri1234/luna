import type { RetrievedChunk, RetrieveQuery } from "@shared/documents";
import type { Logger } from "@shared/logger";

import type { RetrievedContextChunk } from "@/ai/prompt/prompt-context";

import type {
  Citation,
  DocumentChatPort,
  DocumentChatResult,
  DocumentUsed,
} from "./citation.types";

/**
 * # DocumentChatService
 *
 * Connects the main-process RetrieverService to the chat pipeline. Given a
 * question it retrieves the most relevant chunks, turns them into prompt
 * context + citations + the list of documents used, and caches the result
 * per conversation so repeated questions don't re-query.
 *
 * It does NOT stream or call the model — the conversation manager does
 * that with the context this service returns. It also opens the source
 * document for a citation (via the injected file opener).
 */

const SNIPPET_CHARS = 180;
const CACHE_PER_CONVERSATION = 50;

export interface DocumentChatOptions {
  /** Top-K chunks to retrieve. */
  k: number;
  /** Minimum similarity to keep a chunk (filters weak matches). */
  minScore: number;
}

const DEFAULT_OPTIONS: DocumentChatOptions = { k: 6, minScore: 0.35 };

export class DocumentChatService implements DocumentChatPort {
  private readonly options: DocumentChatOptions;
  /** conversationId → normalized query → result. */
  private readonly cache = new Map<string, Map<string, DocumentChatResult>>();

  constructor(
    private readonly retrieve: (input: RetrieveQuery) => Promise<RetrievedChunk[]>,
    private readonly openFile: (sourceFileId: string) => Promise<void>,
    private readonly logger: Logger,
    options: Partial<DocumentChatOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Retrieves relevant chunks for `query` and assembles the grounding
   * bundle. Cached per conversation; retrieval failures degrade to
   * "no results" so chat never breaks.
   */
  async answerWithDocuments(
    query: string,
    conversationId: string | null,
  ): Promise<DocumentChatResult> {
    const convKey = conversationId ?? "__unsaved__";
    const queryKey = query.trim().toLowerCase().replace(/\s+/g, " ");

    const cached = this.cache.get(convKey)?.get(queryKey);
    if (cached) return cached;

    let chunks: RetrievedChunk[] = [];
    try {
      chunks = await this.retrieve({ query, k: this.options.k, minScore: this.options.minScore });
    } catch (error) {
      this.logger.warn("document retrieval failed", { error: String(error) });
    }

    const result = this.assemble(chunks);
    this.remember(convKey, queryKey, result);
    this.logger.debug("document chat retrieval", {
      chunks: chunks.length,
      documents: result.documentsUsed.length,
    });
    return result;
  }

  /** Maps one retrieved chunk to a display citation. */
  buildCitation(chunk: RetrievedChunk, index: number): Citation {
    return {
      id: chunk.chunkId,
      index,
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      sourceFileId: chunk.document.sourceFileId,
      documentTitle: chunk.document.title,
      kind: chunk.document.kind,
      page: chunk.chunk.page,
      headingPath: chunk.chunk.headingPath,
      score: chunk.score,
      snippet: truncate(chunk.text, SNIPPET_CHARS),
    };
  }

  /**
   * Opens the source document for a citation. An external viewer can't be
   * told the page, so we open the file and rely on the citation's page /
   * section label for the user to jump to.
   */
  async openCitation(citation: Citation): Promise<void> {
    try {
      await this.openFile(citation.sourceFileId);
    } catch (error) {
      this.logger.warn("open citation failed", { error: String(error) });
    }
  }

  /** Builds citations, documents-used, and prompt context from raw hits. */
  private assemble(chunks: RetrievedChunk[]): DocumentChatResult {
    const citations = chunks.map((chunk, i) => this.buildCitation(chunk, i + 1));

    const byDocument = new Map<string, DocumentUsed>();
    for (const chunk of chunks) {
      const existing = byDocument.get(chunk.documentId);
      if (existing) existing.chunkCount += 1;
      else
        byDocument.set(chunk.documentId, {
          documentId: chunk.documentId,
          sourceFileId: chunk.document.sourceFileId,
          title: chunk.document.title,
          kind: chunk.document.kind,
          chunkCount: 1,
        });
    }

    const context: RetrievedContextChunk[] = chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      text: chunk.text,
      documentTitle: chunk.document.title,
      page: chunk.chunk.page,
      headingPath: chunk.chunk.headingPath,
      position: chunk.chunk.position,
      score: chunk.score,
    }));

    return {
      citations,
      documentsUsed: [...byDocument.values()],
      context,
      noResults: chunks.length === 0,
    };
  }

  private remember(convKey: string, queryKey: string, result: DocumentChatResult): void {
    let bucket = this.cache.get(convKey);
    if (!bucket) {
      bucket = new Map();
      this.cache.set(convKey, bucket);
    }
    // Bound the per-conversation cache (drop oldest).
    if (bucket.size >= CACHE_PER_CONVERSATION) {
      const oldest = bucket.keys().next().value;
      if (oldest !== undefined) bucket.delete(oldest);
    }
    bucket.set(queryKey, result);
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max).trimEnd()}…`;
}
