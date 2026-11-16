/**
 * # Memory search
 *
 * `MemorySearchStrategy` scores how relevant a memory is to a query.
 * `TokenOverlapSearch` is the vocabulary heuristic. `EmbeddingMemorySearch`
 * implements the same tokenize/score methods and, when a local embedding
 * model is available, ranks by cosine similarity instead. Callers fall
 * back to the token scores when that call cannot run.
 */

import { createLogger } from "../../../shared/logger";

export interface MemorySearchStrategy {
  /** Relevance in [0, 1]; 0 means unrelated. */
  score(queryTokens: Set<string>, docTokens: Set<string>): number;
  tokenize(text: string): Set<string>;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "to", "of", "in", "on", "at", "for", "with", "my", "your", "i", "you", "me",
  "it", "this", "that", "have", "has", "do", "does", "did", "so", "as", "if",
  "then", "than", "too", "very", "can", "will", "would", "should", "am", "we",
]);

export class TokenOverlapSearch implements MemorySearchStrategy {
  tokenize(text: string): Set<string> {
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !STOPWORDS.has(word));
    return new Set(tokens);
  }

  /**
   * Containment-weighted overlap: how much of the query is covered by
   * the memory, lightly boosted by shared vocabulary. Asymmetric on
   * purpose — a short query fully covered by a long memory still scores
   * high.
   */
  score(queryTokens: Set<string>, docTokens: Set<string>): number {
    if (queryTokens.size === 0 || docTokens.size === 0) return 0;
    let shared = 0;
    for (const token of queryTokens) if (docTokens.has(token)) shared += 1;
    if (shared === 0) return 0;
    const containment = shared / queryTokens.size;
    const jaccard = shared / (queryTokens.size + docTokens.size - shared);
    return 0.7 * containment + 0.3 * jaccard;
  }
}

/** Local embedding model. Empty vectors mean "do not use embeddings". */
export interface TextEmbedder {
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface SemanticDocument {
  id: string;
  text: string;
  /** Stored vector for the current model, or null when it must be computed. */
  embedding: number[] | null;
}

export interface SemanticRankResult {
  scores: Map<string, number>;
  /** Vectors computed during this call. The repository persists them. */
  vectors: { id: string; embedding: number[] }[];
  mode: "embeddings" | "tokens";
}

const semanticLog = createLogger("main:db:memory:search");

function cosine(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return Math.max(0, dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)));
}

/**
 * Token overlap plus optional local embeddings. `tokenize` and `score`
 * stay on the heuristic so duplicate detection and always/never rules
 * do not call the model. `rank` uses embeddings when the embedder
 * returns vectors, and the token scores otherwise.
 */
export class EmbeddingMemorySearch implements MemorySearchStrategy {
  private readonly tokens = new TokenOverlapSearch();

  constructor(private readonly embedder: TextEmbedder) {}

  get model(): string {
    return this.embedder.model;
  }

  tokenize(text: string): Set<string> {
    return this.tokens.tokenize(text);
  }

  score(queryTokens: Set<string>, docTokens: Set<string>): number {
    return this.tokens.score(queryTokens, docTokens);
  }

  /** Embeds documents that do not yet have a vector. Failures return nothing. */
  async embedDocuments(
    documents: SemanticDocument[],
  ): Promise<{ id: string; embedding: number[] }[]> {
    const missing = documents.filter((document) => !document.embedding?.length);
    if (missing.length === 0) return [];
    try {
      const vectors = await this.embedder.embed(missing.map((document) => document.text));
      const fresh: { id: string; embedding: number[] }[] = [];
      missing.forEach((document, index) => {
        const embedding = vectors[index] ?? [];
        if (embedding.length > 0) fresh.push({ id: document.id, embedding });
      });
      return fresh;
    } catch (error) {
      semanticLog.warn("could not embed memories", { error: String(error) });
      return [];
    }
  }

  /**
   * Similarity of `query` to each document. Embeddings when the local
   * model answers; token overlap when it does not (toggle off, Ollama
   * down, model missing).
   */
  async rank(query: string, documents: SemanticDocument[]): Promise<SemanticRankResult> {
    const tokenResult = (): SemanticRankResult => {
      const queryTokens = this.tokenize(query);
      const scores = new Map<string, number>();
      for (const document of documents) {
        scores.set(document.id, this.score(queryTokens, this.tokenize(document.text)));
      }
      return { scores, vectors: [], mode: "tokens" };
    };

    const trimmed = query.trim();
    if (!trimmed || documents.length === 0) return tokenResult();

    try {
      const missing = documents.filter((document) => !document.embedding?.length);
      const vectors = await this.embedder.embed([
        trimmed,
        ...missing.map((document) => document.text),
      ]);
      const queryVector = vectors[0] ?? [];
      if (queryVector.length === 0) return tokenResult();

      const byId = new Map<string, number[]>();
      const fresh: { id: string; embedding: number[] }[] = [];
      missing.forEach((document, index) => {
        const embedding = vectors[index + 1] ?? [];
        if (embedding.length === queryVector.length) {
          byId.set(document.id, embedding);
          fresh.push({ id: document.id, embedding });
        }
      });
      for (const document of documents) {
        if (byId.has(document.id)) continue;
        if (document.embedding && document.embedding.length === queryVector.length) {
          byId.set(document.id, document.embedding);
        }
      }

      const scores = new Map<string, number>();
      for (const document of documents) {
        const embedding = byId.get(document.id);
        scores.set(document.id, embedding ? cosine(queryVector, embedding) : 0);
      }
      return { scores, vectors: fresh, mode: "embeddings" };
    } catch (error) {
      semanticLog.warn("embedding search failed; using token overlap", {
        error: String(error),
      });
      return tokenResult();
    }
  }
}
