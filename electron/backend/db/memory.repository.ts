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
import { type MemorySearchStrategy, TokenOverlapSearch } from "./memory-search";
import { memories, memoryRules } from "./schema";

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
 */

const log = createLogger("main:db:memory");

/** Similarity at/above which two memories are considered the same. */
const DUPLICATE_THRESHOLD = 0.6;
/** Similarity at/above which a candidate matches a user rule. */
const RULE_THRESHOLD = 0.45;
/** Minimum relevance to inject a memory into a prompt. */
const RELEVANCE_THRESHOLD = 0.12;
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

export class MemoryRepository {
  constructor(
    private readonly db: Db,
    private readonly search: MemorySearchStrategy = new TokenOverlapSearch(),
  ) {}

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

  /** Title/value substring + token search for the Memory page. */
  searchMemories(query: string): MemoryRecord[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return this.listMemories();
    const queryTokens = this.search.tokenize(needle);
    return this.listMemories()
      .map((memory) => {
        const substring =
          memory.key.toLowerCase().includes(needle) ||
          memory.value.toLowerCase().includes(needle);
        const score = substring
          ? 1
          : this.search.score(queryTokens, this.tokensOf(memory));
        return { memory, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.memory);
  }

  /**
   * The memories most relevant to `query`, for prompt injection. Only
   * active (non-archived) memories; bumps `lastUsed` on those returned.
   */
  getRelevantMemories(query: string, limit = RELEVANCE_LIMIT): MemoryRecord[] {
    const queryTokens = this.search.tokenize(query);
    if (queryTokens.size === 0) return [];

    const active = this.listMemories().filter((memory) => !memory.isArchived);
    const ranked = active
      .map((memory) => ({ memory, score: this.search.score(queryTokens, this.tokensOf(memory)) }))
      .filter((entry) => entry.score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (ranked.length > 0) {
      const now = Date.now();
      const ids = ranked.map((entry) => entry.memory.id);
      this.db.transaction((tx) => {
        for (const id of ids) {
          tx.update(memories).set({ lastUsed: now }).where(eq(memories.id, id)).run();
        }
      });
    }
    return ranked.map((entry) => entry.memory);
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
