import { PersistenceError } from "../../shared/conversations";
import {
  type AddRuleInput,
  type CandidateDisposition,
  type DbResult,
  type MemoryCandidate,
  type MemoryRecord,
  type SaveMemoryInput,
  type SaveMemoryResult,
  type UpdateMemoryInput,
} from "../../shared/memory";
import { createLogger } from "../../shared/logger";
import { activityService } from "../activity/activity.service";
import { getDb } from "../backend/db/client";
import { MemoryRepository } from "../backend/db/memory.repository";

/**
 * # Memory controller (main process)
 *
 * Translates IPC calls into repository calls, turning every failure
 * into a `DbResult` (invoke rejections lose error metadata across IPC).
 * The repository is resolved lazily so a database that failed to open
 * yields a clean classified error per call instead of crashing wire-up.
 */

const log = createLogger("main:memory");

function run<T>(operation: string, fn: () => T): DbResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    const code = error instanceof PersistenceError ? error.code : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    log.warn("memory operation failed", { operation, code, message });
    return { ok: false, code, message };
  }
}

export class MemoryController {
  private repository(): MemoryRepository {
    return new MemoryRepository(getDb());
  }

  save(input: SaveMemoryInput): DbResult<SaveMemoryResult> {
    const result = run("save", () => this.repository().saveMemory(input));
    if (result.ok) {
      activityService.logActivity({
        type: "memory-created",
        description: `Remembered "${input.key}"`,
        metadata: { key: input.key, merged: result.data.duplicate },
      });
    }
    return result;
  }

  update(input: UpdateMemoryInput): DbResult<null> {
    const result = run("update", () => {
      this.repository().updateMemory(input);
      return null;
    });
    if (result.ok) {
      activityService.logActivity({
        type: "memory-updated",
        description: "Updated a memory",
        metadata: { id: input.id },
      });
    }
    return result;
  }

  archive(id: string, isArchived: boolean): DbResult<null> {
    return run("archive", () => {
      this.repository().archiveMemory(id, isArchived);
      return null;
    });
  }

  remove(id: string): DbResult<null> {
    const result = run("remove", () => {
      this.repository().deleteMemory(id);
      return null;
    });
    if (result.ok) {
      activityService.logActivity({
        type: "memory-deleted",
        description: "Deleted a memory",
        metadata: { id },
      });
    }
    return result;
  }

  list(): DbResult<MemoryRecord[]> {
    return run("list", () => this.repository().listMemories());
  }

  search(query: string): DbResult<MemoryRecord[]> {
    return run("search", () => this.repository().searchMemories(query));
  }

  relevant(query: string): DbResult<MemoryRecord[]> {
    return run("relevant", () => this.repository().getRelevantMemories(query));
  }

  addRule(input: AddRuleInput): DbResult<null> {
    return run("addRule", () => {
      this.repository().addRule(input);
      return null;
    });
  }

  classify(candidate: MemoryCandidate): DbResult<CandidateDisposition> {
    return run("classify", () => this.repository().classifyCandidate(candidate));
  }
}
