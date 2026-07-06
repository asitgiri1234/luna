/**
 * # Lightweight semantic search (embedding-free)
 *
 * A `MemorySearchStrategy` scores how relevant a memory is to a query.
 * The default implementation is a token-overlap heuristic — no model,
 * no embeddings — good enough to surface the right handful of memories
 * for prompt injection.
 *
 * ## Extension point
 * A future embedding-based strategy (e.g. cosine over vectors from a
 * local model) implements the same interface and is swapped into the
 * repository; nothing else changes.
 */

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
