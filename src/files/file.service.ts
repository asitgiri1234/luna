import {
  type FileOpResult,
  type FileProgress,
  type FileRecord,
  FileError,
  type ImportFileResult,
} from "@shared/files";
import type { LunaFilesApi } from "@/types/electron";

/**
 * # File service (renderer)
 *
 * The only module that talks to the files IPC bridge. Unwraps
 * `FileOpResult` envelopes into values or thrown `FileError`s, so the
 * store can use ordinary try/catch. Components never touch
 * `window.luna` directly.
 */

function bridge(): LunaFilesApi {
  const api = window.luna?.files;
  if (!api) {
    throw new FileError(
      "unknown",
      "The desktop files bridge is unavailable. Launch Luna through Electron.",
    );
  }
  return api;
}

function unwrap<T>(result: FileOpResult<T>): T {
  if (result.ok) return result.data;
  throw new FileError(result.code, result.message);
}

export const fileService = {
  async list(): Promise<FileRecord[]> {
    return unwrap(await bridge().list());
  },

  /** Opens the OS picker and returns chosen absolute paths. */
  async pick(): Promise<string[]> {
    return unwrap(await bridge().pick());
  },

  async import(uploadId: string, sourcePath: string): Promise<ImportFileResult> {
    return unwrap(await bridge().import(uploadId, sourcePath));
  },

  async rename(id: string, filename: string): Promise<FileRecord> {
    return unwrap(await bridge().rename(id, filename));
  },

  async remove(id: string): Promise<void> {
    unwrap(await bridge().remove(id));
  },

  async preview(id: string): Promise<string | null> {
    return unwrap(await bridge().preview(id)).dataUrl;
  },

  async open(id: string): Promise<void> {
    unwrap(await bridge().open(id));
  },

  async reveal(id: string): Promise<void> {
    unwrap(await bridge().reveal(id));
  },

  /** Absolute path for a dropped `File` (Electron webUtils). */
  pathForFile(file: File): string {
    return bridge().pathForFile(file);
  },

  onProgress(callback: (progress: FileProgress) => void): () => void {
    return window.luna?.files.onProgress(callback) ?? (() => {});
  },
};
