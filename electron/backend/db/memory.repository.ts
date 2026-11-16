import { and, desc, eq } from "drizzle-orm";

import {
  type AddRuleInput,
  type CandidateDisposition,
  type MemoryCandidate,
  type MemoryCategory,
  type MemoryRecord,
  type SaveMemoryInput,
  type SaveMemoryResult,
  type UpdateMemoryInput,
  isMemoryCategory,
} from "../../../shared/memory";
import { PersistenceError } from "../../../shared/conversations";
import { createLogger } from "../../../shared/logger";
import type { Db } from "./client";
import { decayWeight } from "./memory-decay";
import { LocalAiTextEmbedder } from "./memory-embedder";
import {
  EmbeddingMemorySearch,
  type SemanticDocument,
  type SemanticRankResult,
} from "./memory-search";
import { memories, memoryEmbeddings, memoryRules } from "./schema";

/**
 * # Memory repository (main process)
 *
 * The ONLY module that queries the memory tables. Speaks in
 * `MemoryRecord` DTOs; owns duplicate detection, relevance retrieval,
 * and rule matching via the injected search strategy.
 *
 * Robustness:
 * - `saveMemory` merges into an existing memory in the same category
 *   with high token similarity instead of inserting a duplicate.
 * - rows with an unrecognized category degrade to `"custom"` rather
 *   than being dropped, so a corrupt value never hides a memory.
 * - search and prompt retrieval prefer local embeddings and fall back
 *   to token overlap. Decay re-ranks; it never deletes.
 */

const log = createLogger("main:db:memory");

/** Similarity at/above which two memories are considered the same. */
const DUPLICATE_THRESHOLD = 0.6;
/** Similarity at/above which a candidate matches a user rule. */
const RULE_THRESHOLD = 0.45;
/** Minimum token-overlap relevance to inject a memory into a prompt. */
const RELEVANCE_THRESHOLD = 0.12;
/** Cosine similarity at/above which an embedding match is injected. */
const SEMANTIC_RELEVANCE_THRESHOLD = 0.45;
/** Cosine similarity at/above which the Memory page keeps a non-substring hit. */
const SEMANTIC_PAGE_THRESHOLD = 0.38;
const RELEVANCE_LIMIT = 6;

interface MemoryRow {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  lastUsed: number | null;
  sourceConversationId: string | null;
  isArchived: boolean;
}

function toRecord(row: MemoryRow): MemoryRecord {
  return {
    ...row,
    category: isMemoryCategory(row.category) ? row.category : "custom",
  };
}

interface StoredEmbedding {
  model: string;
  vector: number[] | null;
  sourceUpdatedAt: number;
}

function parseVector(raw: string): number[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "number")) return null;
    return parsed as number[];
  } catch {
    return null;
  }
}

export class MemoryRepository {
  private readonly search: EmbeddingMemorySearch;

  constructor(private readonly db: Db, search?: EmbeddingMemorySearch) {
    this.search = search ?? new EmbeddingMemorySearch(new LocalAiTextEmbedder());
  }

  private tokensOf(memory: { key: string; value: string }): Set<string> {
    return this.search.tokenize(`${memory.key} ${memory.value}`);
  }

  saveMemory(input: SaveMemoryInput): SaveMemoryResult {
    const candidateTokens = this.tokensOf(input);
    const now = Date.now();

    // Duplicate detection: same category, high token similarity → merge.
    const sameCategory = this.db
      .select()
      .from(memories)
      .where(and(eq(memories.category, input.category), eq(memories.isArchived, false)))
      .all() as MemoryRow[];

    for (const existing of sameCategory) {
      const score = this.search.score(candidateTokens, this.tokensOf(existing));
      if (score >= DUPLICATE_THRESHOLD) {
        this.db
          .update(memories)
          .set({
            value: input.value,
            confidence: Math.max(existing.confidence, input.confidence),
            updatedAt: now,
          })
          .where(eq(memories.id, existing.id))
          .run();
        log.info("merged into existing memory", { id: existing.id });
        return { memory: toRecord({ ...existing, value: input.value, updatedAt: now }), duplicate: true };
      }
    }

    const row: MemoryRow = {
      id: crypto.randomUUID(),
      category: input.category,
      key: input.key,
      value: input.value,
      confidence: input.confidence,
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
      sourceConversationId: input.sourceConversationId,
      isArchived: false,
    };
    this.db.insert(memories).values(row).run();
    return { memory: toRecord(row), duplicate: false };
  }

  updateMemory(input: UpdateMemoryInput): void {
    const patch: Partial<MemoryRow> = { updatedAt: Date.now() };
    if (input.category !== undefined) patch.category = input.category;
    if (input.key !== undefined) patch.key = input.key;
    if (input.value !== undefined) patch.value = input.value;
    const result = this.db
      .update(memories)
      .set(patch)
      .where(eq(memories.id, input.id))
      .run();
    if (result.changes === 0) {
      throw new PersistenceError("not-found", `Memory "${input.id}" does not exist.`);
    }
  }

  archiveMemory(id: string, isArchived: boolean): void {
    const result = this.db
      .update(memories)
      .set({ isArchived, updatedAt: Date.now() })
      .where(eq(memories.id, id))
      .run();
    if (result.changes === 0) {
      throw new PersistenceError("not-found", `Memory "${id}" does not exist.`);
    }
  }

  deleteMemory(id: string): void {
    this.db.delete(memories).where(eq(memories.id, id)).run();
  }

  /** All memories, newest first. Includes archived (the page filters). */
  listMemories(): MemoryRecord[] {
    const rows = this.db
      .select()
      .from(memories)
      .orderBy(desc(memories.updatedAt))
      .all() as MemoryRow[];
    return rows.map(toRecord);
  }

  /** Title/value substring plus semantic (or token) search for the Memory page. */
  async searchMemories(query: string): Promise<MemoryRecord[]> {
    const all = this.listMemories();
    const needle = query.trim().toLowerCase();
    if (!needle) return all;

    const ranked = await this.rankMemories(needle, all);
    const now = Date.now();
    return all
      .map((memory) => {
        const substring =
          memory.key.toLowerCase().includes(needle) ||
          memory.value.toLowerCase().includes(needle);
        const similarity = substring ? 1 : (ranked.scores.get(memory.id) ?? 0);
        return { memory, similarity, rank: similarity * decayWeight(memory, now) };
      })
      .filter((entry) => {
        if (
          entry.memory.key.toLowerCase().includes(needle) ||
          entry.memory.value.toLowerCase().includes(needle)
        ) {
          return true;
        }
        return ranked.mode === "embeddings"
          ? entry.similarity >= SEMANTIC_PAGE_THRESHOLD
          : entry.similarity > 0;
      })
      .sort((a, b) => b.rank - a.rank)
      .map((entry) => entry.memory);
  }

  /**
   * The memories most relevant to `query`, for prompt injection. Only
   * active (non-archived) memories; bumps `lastUsed` on those returned.
   * Similarity decides what qualifies. Decay only changes the order, so
   * an old memory is not dropped for being old.
   */
  async getRelevantMemories(query: string, limit = RELEVANCE_LIMIT): Promise<MemoryRecord[]> {
    if (!query.trim()) return [];
    const active = this.listMemories().filter((memory) => !memory.isArchived);
    const ranked = await this.rankMemories(query, active);
    const threshold =
      ranked.mode === "embeddings" ? SEMANTIC_RELEVANCE_THRESHOLD : RELEVANCE_THRESHOLD;
    const now = Date.now();
    const picked = active
      .map((memory) => {
        const similarity = ranked.scores.get(memory.id) ?? 0;
        return { memory, similarity, rank: similarity * decayWeight(memory, now) };
      })
      .filter((entry) => entry.similarity >= threshold)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit);

    if (picked.length > 0) {
      const ids = picked.map((entry) => entry.memory.id);
      this.db.transaction((tx) => {
        for (const id of ids) {
          tx.update(memories).set({ lastUsed: now }).where(eq(memories.id, id)).run();
        }
      });
    }
    return picked.map((entry) => entry.memory);
  }

  /** Embeds the given memories when Local AI is on. Failures are logged, not thrown. */
  async refreshEmbeddings(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      const wanted = new Set(ids);
      const selected = this.listMemories().filter((memory) => wanted.has(memory.id));
      const documents = this.toSemantic(selected).map((document) => ({
        ...document,
        embedding: null,
      }));
      const vectors = await this.search.embedDocuments(documents);
      this.persistVectors(vectors, new Map(selected.map((memory) => [memory.id, memory])));
    } catch (error) {
      log.warn("memory embedding refresh failed", { error: String(error) });
    }
  }

  private async rankMemories(query: string, rows: MemoryRecord[]): Promise<SemanticRankResult> {
    const documents = this.toSemantic(rows);
    const ranked = await this.search.rank(query, documents);
    this.persistVectors(ranked.vectors, new Map(rows.map((memory) => [memory.id, memory])));
    return ranked;
  }

  private toSemantic(rows: MemoryRecord[]): SemanticDocument[] {
    const stored = this.storedEmbeddings();
    const model = this.search.model;
    return rows.map((memory) => {
      const row = stored.get(memory.id);
      const fresh =
        row && row.model === model && row.sourceUpdatedAt === memory.updatedAt && row.vector
          ? row.vector
          : null;
      return { id: memory.id, text: `${memory.key}\n${memory.value}`, embedding: fresh };
    });
  }

  private storedEmbeddings(): Map<string, StoredEmbedding> {
    const rows = this.db.select().from(memoryEmbeddings).all() as {
      memoryId: string;
      model: string;
      embedding: string;
      sourceUpdatedAt: number;
    }[];
    const map = new Map<string, StoredEmbedding>();
    for (const row of rows) {
      map.set(row.memoryId, {
        model: row.model,
        vector: parseVector(row.embedding),
        sourceUpdatedAt: row.sourceUpdatedAt,
      });
    }
    return map;
  }

  private persistVectors(
    vectors: { id: string; embedding: number[] }[],
    byId: Map<string, MemoryRecord>,
  ): void {
    if (vectors.length === 0) return;
    const model = this.search.model;
    this.db.transaction((tx) => {
      for (const vector of vectors) {
        const memory = byId.get(vector.id);
        if (!memory || vector.embedding.length === 0) continue;
        const values = {
          memoryId: vector.id,
          model,
          dimensions: vector.embedding.length,
          embedding: JSON.stringify(vector.embedding),
          sourceUpdatedAt: memory.updatedAt,
        };
        tx.insert(memoryEmbeddings)
          .values(values)
          .onConflictDoUpdate({
            target: memoryEmbeddings.memoryId,
            set: {
              model: values.model,
              dimensions: values.dimensions,
              embedding: values.embedding,
              sourceUpdatedAt: values.sourceUpdatedAt,
            },
          })
          .run();
      }
    });
  }

  // -- Rules ----------------------------------------------------------------

  addRule(input: AddRuleInput): void {
    this.db
      .insert(memoryRules)
      .values({
        id: crypto.randomUUID(),
        kind: input.kind,
        category: input.category,
        tokens: input.tokens.join(" "),
        createdAt: Date.now(),
      })
      .run();
  }

  /** Decides how a candidate should be handled given standing rules. */
  classifyCandidate(candidate: MemoryCandidate): CandidateDisposition {
    const candidateTokens = this.tokensOf(candidate);
    const rules = this.db
      .select()
      .from(memoryRules)
      .where(eq(memoryRules.category, candidate.category))
      .all() as { kind: string; tokens: string }[];

    let matchedAlways = false;
    for (const rule of rules) {
      const score = this.search.score(candidateTokens, new Set(rule.tokens.split(" ")));
      if (score < RULE_THRESHOLD) continue;
      if (rule.kind === "never") return "never"; // never wins
      if (rule.kind === "always") matchedAlways = true;
    }
    return matchedAlways ? "always" : "ask";
  }

  /** Token bag describing a candidate, for creating a rule from it. */
  candidateTokens(candidate: { key: string; value: string }): string[] {
    return [...this.tokensOf(candidate)];
  }

  categoryOf(category: string): MemoryCategory {
    return isMemoryCategory(category) ? category : "custom";
  }
}
