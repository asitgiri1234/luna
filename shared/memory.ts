/**
 * # Shared memory contract
 *
 * Wire types for the Personal Memory Engine, crossing IPC between the
 * renderer's memory services (`src/ai/memory/`) and the main-process
 * repository (`electron/backend/db/memory.repository.ts`). Free of
 * imports from either side.
 *
 * Privacy-first: nothing here saves a memory on its own. Candidates are
 * proposed; only an explicit approval (or a standing "always" rule the
 * user created) results in a `saveMemory` call.
 */

import type { ChatRole } from "./ai";
import type { DbResult } from "./conversations";

export type { DbResult };

// Re-export so `ChatRole` stays reachable without importing ai.ts elsewhere.
export type { ChatRole };

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const MEMORY_CATEGORIES = [
  "identity",
  "preferences",
  "projects",
  "people",
  "goals",
  "writing-style",
  "favorites",
  "custom",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export function isMemoryCategory(value: string): value is MemoryCategory {
  return (MEMORY_CATEGORIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Records / candidates
// ---------------------------------------------------------------------------

/** A memory as stored and shown on the Memory page. */
export interface MemoryRecord {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  lastUsed: number | null;
  sourceConversationId: string | null;
  isArchived: boolean;
}

/** A proposed memory awaiting the user's decision. Not yet persisted. */
export interface MemoryCandidate {
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  reason: string;
  sourceConversationId: string | null;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface SaveMemoryInput {
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  sourceConversationId: string | null;
}

export interface UpdateMemoryInput {
  id: string;
  category?: MemoryCategory;
  key?: string;
  value?: string;
}

/** Outcome of a save: a brand-new memory, or a merge into a duplicate. */
export interface SaveMemoryResult {
  memory: MemoryRecord;
  duplicate: boolean;
}

// ---------------------------------------------------------------------------
// "Always / never remember similar" rules
// ---------------------------------------------------------------------------

export type MemoryRuleKind = "always" | "never";

export interface AddRuleInput {
  kind: MemoryRuleKind;
  category: MemoryCategory;
  /** Tokens describing the candidate this rule generalizes from. */
  tokens: string[];
}

/** How a candidate should be treated given the user's standing rules. */
export type CandidateDisposition = "ask" | "always" | "never";

// ---------------------------------------------------------------------------
// IPC channels
// ---------------------------------------------------------------------------

export const MEMORY_CHANNELS = {
  save: "memory:save",
  update: "memory:update",
  archive: "memory:archive",
  remove: "memory:delete",
  list: "memory:list",
  search: "memory:search",
  relevant: "memory:relevant",
  addRule: "memory:add-rule",
  classify: "memory:classify",
} as const;
