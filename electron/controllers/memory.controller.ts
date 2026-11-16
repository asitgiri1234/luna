import { promises as fs } from "node:fs";

import { BrowserWindow, type WebContents, dialog } from "electron";

import { PersistenceError } from "../../shared/conversations";
import {
  type AddRuleInput,
  type CandidateDisposition,
  type DbResult,
  type MemoryCandidate,
  type MemoryExportResult,
  type MemoryRecord,
  type SaveMemoryInput,
  type SaveMemoryResult,
  type UpdateMemoryInput,
} from "../../shared/memory";
import { createLogger } from "../../shared/logger";
import { activityService } from "../activity/activity.service";
import { getDb } from "../backend/db/client";
import { MemoryRepository } from "../backend/db/memory.repository";
import {
  assertPermission,
  isPermissionAllowed,
  recordPermissionUse,
} from "../permissions/permission.gate";

/**
 * # Memory controller (main process)
 *
 * Translates IPC calls into repository calls, turning every failure
 * into a `DbResult` (invoke rejections lose error metadata across IPC).
 * The repository is resolved lazily so a database that failed to open
 * yields a clean classified error per call instead of crashing wire-up.
 */

const log = createLogger("main:memory");

function fail<T>(operation: string, error: unknown): DbResult<T> {
  const code = error instanceof PersistenceError ? error.code : "unknown";
  const message = error instanceof Error ? error.message : String(error);
  log.warn("memory operation failed", { operation, code, message });
  return { ok: false, code, message };
}

function run<T>(operation: string, fn: () => T): DbResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    return fail(operation, error);
  }
}

async function runAsync<T>(operation: string, fn: () => Promise<T>): Promise<DbResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return fail(operation, error);
  }
}

export class MemoryController {
  private repository(): MemoryRepository {
    return new MemoryRepository(getDb());
  }

  async save(input: SaveMemoryInput): Promise<DbResult<SaveMemoryResult>> {
    const result = run("save", () => {
      assertPermission("memory");
      recordPermissionUse("memory");
      return this.repository().saveMemory(input);
    });
    if (result.ok) {
      await this.repository().refreshEmbeddings([result.data.memory.id]);
      activityService.logActivity({
        type: "memory-created",
        description: `Remembered "${input.key}"`,
        metadata: { key: input.key, merged: result.data.duplicate },
      });
    }
    return result;
  }

  async update(input: UpdateMemoryInput): Promise<DbResult<null>> {
    const result = run("update", () => {
      this.repository().updateMemory(input);
      return null;
    });
    if (result.ok) await this.repository().refreshEmbeddings([input.id]);
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

  search(query: string): Promise<DbResult<MemoryRecord[]>> {
    return runAsync("search", () => this.repository().searchMemories(query));
  }

  async relevant(query: string): Promise<DbResult<MemoryRecord[]>> {
    // Disabled memory must not break chat — the reply just isn't personalized.
    if (!isPermissionAllowed("memory")) return { ok: true, data: [] };
    const result = await runAsync("relevant", () => this.repository().getRelevantMemories(query));
    if (result.ok && result.data.length > 0) recordPermissionUse("memory");
    return result;
  }

  /**
   * Writes every memory to a JSON file the user chooses. Stays on this
   * computer: the dialog is a local save, and nothing is uploaded.
   * Listing is allowed even when the Memory toggle is off.
   */
  exportMemories(sender: WebContents): Promise<DbResult<MemoryExportResult>> {
    return runAsync("export", async () => {
      const memories = this.repository().listMemories();
      const window = BrowserWindow.fromWebContents(sender);
      const picked = await dialog.showSaveDialog(window ?? undefined!, {
        title: "Export memories",
        defaultPath: "luna-memories.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (picked.canceled || !picked.filePath) return { saved: false, path: null };
      const body = JSON.stringify(
        { exportedAt: new Date().toISOString(), memories },
        null,
        2,
      );
      await fs.writeFile(picked.filePath, body, "utf8");
      log.info("memories exported", { count: memories.length });
      return { saved: true, path: picked.filePath };
    });
  }

  addRule(input: AddRuleInput): DbResult<null> {
    return run("addRule", () => {
      assertPermission("memory");
      this.repository().addRule(input);
      return null;
    });
  }

  classify(candidate: MemoryCandidate): DbResult<CandidateDisposition> {
    return run("classify", () => this.repository().classifyCandidate(candidate));
  }
}
