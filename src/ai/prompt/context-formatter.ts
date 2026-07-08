import {
  type ContextLimits,
  DEFAULT_CONTEXT_LIMITS,
  type RetrievedContextChunk,
} from "./prompt-context";

/**
 * # ContextFormatter
 *
 * Turns retrieved chunks into a single, clearly delimited block of
 * document context for the LLM:
 *
 *   Relevant Document Context:
 *   ---
 *   [Document: Resume.pdf | Page 2]
 *   …chunk text…
 *
 *   [Document: Notes.md]
 *   …chunk text…
 *   ---
 *
 * It de-duplicates chunks, preserves their given order, and trims to a
 * configurable budget (max characters / max chunks). Pure string work —
 * no retrieval, embeddings, or model calls.
 */
export class ContextFormatter {
  constructor(private readonly limits: ContextLimits = DEFAULT_CONTEXT_LIMITS) {}

  /**
   * Full pipeline: de-duplicate → preserve order → trim to budget →
   * format. Returns "" when there is no context to inject.
   */
  buildDocumentContext(
    chunks: RetrievedContextChunk[],
    limits: ContextLimits = this.limits,
  ): string {
    return this.formatContext(this.trimContext(chunks, limits));
  }

  /**
   * Removes duplicate chunks (by id and by identical text) and limits the
   * result to the budget, preserving the input order. The first chunk is
   * always kept even if it alone exceeds `maxChars`.
   */
  trimContext(
    chunks: RetrievedContextChunk[],
    limits: ContextLimits = this.limits,
  ): RetrievedContextChunk[] {
    const seen = new Set<string>();
    const kept: RetrievedContextChunk[] = [];
    let usedChars = 0;

    for (const chunk of chunks) {
      const textKey = normalizeText(chunk.text);
      if (!textKey) continue;
      const idKey = chunk.chunkId ? `id:${chunk.chunkId}` : "";
      if ((idKey && seen.has(idKey)) || seen.has(textKey)) continue;

      if (limits.maxChunks !== undefined && kept.length >= limits.maxChunks) break;
      const cost = this.entryLength(chunk);
      if (kept.length > 0 && usedChars + cost > limits.maxChars) break;

      if (idKey) seen.add(idKey);
      seen.add(textKey);
      kept.push(chunk);
      usedChars += cost;
    }
    return kept;
  }

  /** Renders already-trimmed chunks into the delimited context block. */
  formatContext(chunks: RetrievedContextChunk[]): string {
    if (chunks.length === 0) return "";
    const body = chunks
      .map((chunk) => `${this.header(chunk)}\n${chunk.text.trim()}`)
      .join("\n\n");
    return `Relevant Document Context:\n---\n${body}\n---`;
  }

  /** e.g. "[Document: Resume.pdf | Page 2]" or "[Document: Notes.md]". */
  private header(chunk: RetrievedContextChunk): string {
    const label = chunk.documentTitle.trim() || "Document";
    const parts = [`Document: ${label}`];
    if (chunk.page !== undefined) {
      parts.push(`Page ${chunk.page}`);
    } else if (chunk.headingPath && chunk.headingPath.length > 0) {
      parts.push(chunk.headingPath[chunk.headingPath.length - 1]);
    }
    return `[${parts.join(" | ")}]`;
  }

  /** Approximate rendered length of one entry (header + text + spacing). */
  private entryLength(chunk: RetrievedContextChunk): number {
    return this.header(chunk).length + chunk.text.trim().length + 2;
  }
}

/** Lowercased, whitespace-collapsed text used as a duplicate key. */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
