import path from "node:path";

import { type BrowserWindow, type WebContents, dialog, shell } from "electron";

import { PersistenceError } from "../../shared/conversations";
import {
  FILE_CHANNELS,
  type FileOpResult,
  type FilePreview,
  type FileRecord,
  FileError,
  type ImportFileResult,
  SUPPORTED_EXTENSIONS,
} from "../../shared/files";
import { createLogger } from "../../shared/logger";
import { activityService } from "../activity/activity.service";
import { FileRepository } from "../files/file.repository";
import {
  copyIntoWorkspace,
  readImagePreview,
  removeFromWorkspace,
  resolveStorage,
} from "../files/workspace";

/**
 * # Files controller (main process)
 *
 * Orchestrates the workspace (bytes) and the repository (metadata) and
 * wraps every operation in a `FileOpResult`. An import: copy + hash into
 * the workspace → de-dup by hash → insert metadata. Deleting removes
 * both the row and the file.
 */

const log = createLogger("main:files");

function run<T>(operation: string, fn: () => T | Promise<T>): Promise<FileOpResult<T>> {
  return Promise.resolve()
    .then(fn)
    .then((data) => ({ ok: true as const, data }))
    .catch((error) => {
      const code =
        error instanceof FileError
          ? error.code
          : error instanceof PersistenceError
            ? "db-unavailable"
            : "unknown";
      const message = error instanceof Error ? error.message : String(error);
      log.warn("file operation failed", { operation, code, message });
      return { ok: false as const, code, message };
    });
}

export class FilesController {
  private readonly repository = new FileRepository();

  /** Opens the OS file picker; returns chosen absolute paths (may be empty). */
  async pick(window: BrowserWindow | null): Promise<FileOpResult<string[]>> {
    return run("pick", async () => {
      const result = await dialog.showOpenDialog(window ?? undefined!, {
        title: "Add files to Luna",
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "Supported files", extensions: SUPPORTED_EXTENSIONS }],
      });
      return result.canceled ? [] : result.filePaths;
    });
  }

  /** Copies one file into the workspace and records its metadata. */
  async import(
    sender: WebContents,
    uploadId: string,
    sourcePath: string,
  ): Promise<FileOpResult<ImportFileResult>> {
    const result = await run("import", async () => {
      const id = crypto.randomUUID();
      const copied = await copyIntoWorkspace(id, sourcePath, (loaded, total) => {
        if (!sender.isDestroyed()) {
          sender.send(FILE_CHANNELS.progress, { uploadId, loaded, total });
        }
      });

      // De-dup: if an identical file already exists, drop the fresh copy.
      const existing = this.repository.findByHash(copied.hash);
      if (existing) {
        await removeFromWorkspace(copied.storageLocation);
        return { file: existing, duplicate: true };
      }

      const now = Date.now();
      const record: FileRecord = {
        id,
        filename: path.basename(sourcePath),
        type: copied.kind,
        size: copied.size,
        createdAt: now,
        updatedAt: now,
        hash: copied.hash,
        storageLocation: copied.storageLocation,
      };
      this.repository.insert(record);
      return { file: record, duplicate: false };
    });
    if (result.ok) {
      activityService.logActivity({
        type: "file-uploaded",
        description: `Uploaded ${result.data.file.filename}`,
        metadata: { fileId: result.data.file.id, duplicate: result.data.duplicate },
      });
    }
    return result;
  }

  list(): Promise<FileOpResult<FileRecord[]>> {
    return run("list", () => this.repository.list());
  }

  rename(id: string, filename: string): Promise<FileOpResult<FileRecord>> {
    return run("rename", () => {
      const clean = filename.trim();
      if (!clean) throw new FileError("unknown", "A file name can't be empty.");
      return this.repository.rename(id, clean);
    });
  }

  remove(id: string): Promise<FileOpResult<null>> {
    return run("remove", async () => {
      const record = this.repository.get(id);
      if (record) {
        await removeFromWorkspace(record.storageLocation);
        this.repository.delete(id);
      }
      return null;
    });
  }

  preview(id: string): Promise<FileOpResult<FilePreview>> {
    return run("preview", async () => {
      const record = this.repository.get(id);
      if (!record) throw new FileError("not-found", `File "${id}" not found.`);
      const dataUrl = await readImagePreview(record.storageLocation, record.type);
      return { dataUrl };
    });
  }

  open(id: string): Promise<FileOpResult<null>> {
    return run("open", async () => {
      const record = this.requireFile(id);
      const error = await shell.openPath(resolveStorage(record.storageLocation));
      if (error) throw new FileError("file-missing", error);
      return null;
    });
  }

  reveal(id: string): Promise<FileOpResult<null>> {
    return run("reveal", () => {
      const record = this.requireFile(id);
      shell.showItemInFolder(resolveStorage(record.storageLocation));
      return null;
    });
  }

  private requireFile(id: string): FileRecord {
    const record = this.repository.get(id);
    if (!record) throw new FileError("not-found", `File "${id}" not found.`);
    return record;
  }
}
