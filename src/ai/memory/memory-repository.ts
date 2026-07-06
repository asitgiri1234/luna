import type {
  AddRuleInput,
  CandidateDisposition,
  MemoryCandidate,
  MemoryRecord,
  SaveMemoryInput,
  SaveMemoryResult,
  UpdateMemoryInput,
} from "@shared/memory";

/**
 * # Memory repository (renderer interface)
 *
 * The persistence seam of the memory engine. The memory service and
 * store depend only on this interface; the IPC-backed SQLite
 * implementation is injected by the composition root.
 *
 * All methods reject with `PersistenceError` so callers can degrade
 * gracefully — chat must keep working even when memory storage is
 * unavailable.
 *
 * ## Extension point
 * A future embedding-backed store implements this same interface;
 * tests inject an in-memory implementation.
 */
export interface MemoryRepository {
  saveMemory(input: SaveMemoryInput): Promise<SaveMemoryResult>;
  updateMemory(input: UpdateMemoryInput): Promise<void>;
  archiveMemory(id: string, isArchived: boolean): Promise<void>;
  deleteMemory(id: string): Promise<void>;
  listMemories(): Promise<MemoryRecord[]>;
  searchMemories(query: string): Promise<MemoryRecord[]>;
  getRelevantMemories(query: string): Promise<MemoryRecord[]>;
  addRule(input: AddRuleInput): Promise<void>;
  classifyCandidate(candidate: MemoryCandidate): Promise<CandidateDisposition>;
}
