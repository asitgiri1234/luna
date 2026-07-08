import { createLogger } from "../../../shared/logger";
import type { DocumentChunk, DocumentRecord } from "../../../shared/documents";
import { DocumentRepository } from "../document.repository";
import { EmbeddingService } from "../embeddings/embedding.service";
import { VectorSearchService } from "../embeddings/vector-search.service";
import type { SimilarityResult } from "../embeddings/vector.types";
import {
  DEFAULT_OVERLAP_THRESHOLD,
  DEFAULT_RETRIEVE_K,
  type RetrieveOptions,
  type RetrievedChunk,
} from "./retriever.types";

/**
 * # RetrieverService (main process)
 *
 * Turns a user query into the Top-K most relevant chunks. It composes the
 * existing pieces:
 *
 *   query → EmbeddingService.embedQuery → VectorSearchService.searchSimilar
 *         → hydrate with document + chunk metadata → de-dup → rerank
 *
 * Each result carries its similarity score, document metadata, and chunk
 * metadata (page, heading, position). It only RETRIEVES — no prompt
 * building, LLM calls, or response generation.
 */

const log = createLogger("main:retrieval");

export class RetrieverService {
  private readonly embeddings: EmbeddingService;
  private readonly search: VectorSearchService;
  private readonly documents: DocumentRepository;

  constructor(
    embeddings: EmbeddingService = new EmbeddingService(),
    search: VectorSearchService = new VectorSearchService(),
    documents: DocumentRepository = new DocumentRepository(),
  ) {
    this.embeddings = embeddings;
    this.search = search;
    this.documents = documents;
  }

  /** Retrieves the most relevant chunks for `query`. */
  async retrieve(query: string, options: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
    const k = Math.max(0, options.k ?? DEFAULT_RETRIEVE_K);
    if (k === 0 || !query.trim()) return [];

    const model = options.model ?? this.embeddings.model;
    const vector = await this.embeddings.embedQuery(query, model);
    if (vector.length === 0) return [];

    // Over-fetch so de-duplication + thresholding still leave K results.
    const hits = this.search.searchSimilar(vector, {
      k: Math.max(k * 4, k),
      documentId: options.documentId,
      model,
      minScore: options.minScore,
      excludeChunkIds: options.excludeChunkIds,
    });
    if (hits.length === 0) return [];

    const hydrated = this.hydrate(hits);
    const ranked = this.rerank(hydrated, options);
    log.info("retrieve", {
      query: query.slice(0, 60),
      candidates: hits.length,
      returned: Math.min(k, ranked.length),
      documentId: options.documentId,
    });
    return ranked.slice(0, k);
  }

  /** Retrieval scoped to a single document. */
  retrieveByDocument(
    documentId: string,
    query: string,
    options: RetrieveOptions = {},
  ): Promise<RetrievedChunk[]> {
    return this.retrieve(query, { ...options, documentId });
  }

  /** Retrieval with an explicit K. */
  retrieveTopK(query: string, k: number, options: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
    return this.retrieve(query, { ...options, k });
  }

  /**
   * Orders results by score (desc) and drops near-duplicate overlapping
   * chunks from the same document. Deterministic and LLM-free — a hook a
   * future cross-encoder reranker can replace.
   */
  rerank(
    results: RetrievedChunk[],
    options: Pick<RetrieveOptions, "dedupeOverlap" | "overlapThreshold"> = {},
  ): RetrievedChunk[] {
    const sorted = [...results].sort(
      (a, b) =>
        b.score - a.score ||
        a.documentId.localeCompare(b.documentId) ||
        a.chunk.position - b.chunk.position,
    );
    if (options.dedupeOverlap === false) return sorted;

    const threshold = options.overlapThreshold ?? DEFAULT_OVERLAP_THRESHOLD;
    const kept: RetrievedChunk[] = [];
    const tokenCache = new Map<string, Set<string>>();
    const tokensOf = (result: RetrievedChunk): Set<string> => {
      let set = tokenCache.get(result.chunkId);
      if (!set) {
        set = tokenize(result.text);
        tokenCache.set(result.chunkId, set);
      }
      return set;
    };

    for (const result of sorted) {
      const tokens = tokensOf(result);
      const overlaps = kept.some(
        (existing) =>
          existing.documentId === result.documentId &&
          containment(tokens, tokensOf(existing)) >= threshold,
      );
      if (!overlaps) kept.push(result);
    }
    return kept;
  }

  /** Attaches document + chunk metadata (and text) to raw similarity hits. */
  private hydrate(hits: SimilarityResult[]): RetrievedChunk[] {
    const chunks = new Map<string, DocumentChunk>();
    for (const chunk of this.documents.chunksByIds(hits.map((hit) => hit.chunkId))) {
      chunks.set(chunk.id, chunk);
    }
    const docs = new Map<string, DocumentRecord>();
    for (const documentId of new Set(hits.map((hit) => hit.documentId))) {
      const doc = this.documents.getById(documentId);
      if (doc) docs.set(documentId, doc);
    }

    const results: RetrievedChunk[] = [];
    for (const hit of hits) {
      const chunk = chunks.get(hit.chunkId);
      const doc = docs.get(hit.documentId);
      if (!chunk || !doc) continue; // chunk/doc removed between search and hydrate
      results.push({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        score: hit.score,
        text: chunk.text,
        chunk: {
          position: chunk.position,
          page: chunk.metadata.page,
          headingPath: chunk.metadata.headingPath,
          wordCount: chunk.metadata.wordCount,
          charCount: chunk.metadata.charCount,
        },
        document: {
          id: doc.id,
          sourceFileId: doc.sourceFileId,
          title: doc.title,
          kind: doc.kind,
          language: doc.language,
          author: doc.author,
        },
      });
    }
    return results;
  }
}

/** Lowercased alphanumeric word set. */
function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

/** Containment: |A ∩ B| / min(|A|, |B|) — high when one chunk overlaps another. */
function containment(a: Set<string>, b: Set<string>): number {
  const min = Math.min(a.size, b.size);
  if (min === 0) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const token of small) if (large.has(token)) shared += 1;
  return shared / min;
}
