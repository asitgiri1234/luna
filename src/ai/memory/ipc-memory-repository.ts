import { PersistenceError } from "@shared/conversations";
import type {
  AddRuleInput,
  CandidateDisposition,
  DbResult,
  MemoryCandidate,
  MemoryRecord,
  SaveMemoryInput,
  SaveMemoryResult,
  UpdateMemoryInput,
} from "@shared/memory";
import type { LunaMemoryApi } from "@/types/electron";

import type { MemoryRepository } from "./memory-repository";

/**
 * # IPC-backed memory repository (renderer)
 *
 * Forwards every repository call over the preload bridge to the
 * main-process SQLite memory repository, unwrapping `DbResult`
 * envelopes into typed `PersistenceError`s. Pure transport — no
 * storage or ranking logic.
 */

function unwrap<T>(result: DbResult<T>): T {
  if (result.ok) return result.data;
  throw new PersistenceError(result.code, result.message);
}

const NO_BRIDGE = (): never => {
  throw new PersistenceError(
    "db-unavailable",
    "The desktop persistence bridge is unavailable. Launch Luna through Electron.",
  );
};

export class IpcMemoryRepository implements MemoryRepository {
  constructor(private readonly bridge: LunaMemoryApi | undefined) {}

  private api(): LunaMemoryApi {
    return this.bridge ?? NO_BRIDGE();
  }

  async saveMemory(input: SaveMemoryInput): Promise<SaveMemoryResult> {
    return unwrap(await this.api().save(input));
  }

  async updateMemory(input: UpdateMemoryInput): Promise<void> {
    unwrap(await this.api().update(input));
  }

  async archiveMemory(id: string, isArchived: boolean): Promise<void> {
    unwrap(await this.api().archive(id, isArchived));
  }

  async deleteMemory(id: string): Promise<void> {
    unwrap(await this.api().remove(id));
  }

  async listMemories(): Promise<MemoryRecord[]> {
    return unwrap(await this.api().list());
  }

  async searchMemories(query: string): Promise<MemoryRecord[]> {
    return unwrap(await this.api().search(query));
  }

  async getRelevantMemories(query: string): Promise<MemoryRecord[]> {
    return unwrap(await this.api().relevant(query));
  }

  async addRule(input: AddRuleInput): Promise<void> {
    unwrap(await this.api().addRule(input));
  }

  async classifyCandidate(candidate: MemoryCandidate): Promise<CandidateDisposition> {
    return unwrap(await this.api().classify(candidate));
  }
}
