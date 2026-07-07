import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { app } from "electron";

import {
  EXTENSION_KINDS,
  type FileKind,
  FileError,
  KIND_MIME,
  MAX_FILE_SIZE,
  isImageKind,
} from "../../shared/files";
import { createLogger } from "../../shared/logger";

/**
 * # Luna Workspace (main process)
 *
 * Owns the on-disk file store. Every uploaded file is COPIED here under
 * an id-based name; callers only ever see paths relative to the
 * workspace root, so the store is self-contained and portable.
 *
 *   userData/
 *     workspace/
 *       files/
 *         <id>.<ext>
 */

const log = createLogger("main:files:workspace");

/** Preview only images up to this size as data URLs (memory bound). */
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;

function workspaceRoot(): string {
  return path.join(app.getPath("userData"), "workspace");
}

function filesDir(): string {
  return path.join(workspaceRoot(), "files");
}

/** Absolute path for a stored relative `storageLocation`. */
export function resolveStorage(storageLocation: string): string {
  return path.join(workspaceRoot(), storageLocation);
}

export function kindForExtension(ext: string): FileKind | undefined {
  return EXTENSION_KINDS[ext.toLowerCase()];
}

export interface CopiedFile {
  id: string;
  kind: FileKind;
  size: number;
  hash: string;
  storageLocation: string;
}

/**
 * Copies a source file into the workspace, hashing it in the same pass.
 * Validates type and size first. Reports progress via `onProgress`.
 */
export async function copyIntoWorkspace(
  id: string,
  sourcePath: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<CopiedFile> {
  const ext = path.extname(sourcePath);
  const kind = kindForExtension(ext);
  if (!kind) {
    throw new FileError("unsupported-type", `Files of type "${ext || "unknown"}" aren't supported.`);
  }

  let total: number;
  try {
    total = (await fs.stat(sourcePath)).size;
  } catch {
    throw new FileError("file-missing", "The selected file could not be read.");
  }
  if (total > MAX_FILE_SIZE) {
    throw new FileError("too-large", "That file is larger than the 25 MB limit.");
  }

  await fs.mkdir(filesDir(), { recursive: true });
  const storageLocation = path.join("files", `${id}${ext.toLowerCase()}`);
  const dest = resolveStorage(storageLocation);

  const hash = createHash("sha256");
  let loaded = 0;
  await pipeline(
    createReadStream(sourcePath),
    async function* hashPass(source) {
      for await (const chunk of source) {
        hash.update(chunk as Buffer);
        loaded += (chunk as Buffer).length;
        onProgress(loaded, total);
        yield chunk;
      }
    },
    createWriteStream(dest),
  );

  log.info("file copied into workspace", { id, kind, size: total });
  return { id, kind, size: total, hash: hash.digest("hex"), storageLocation };
}

/** Removes a stored file. Missing files are ignored (already gone). */
export async function removeFromWorkspace(storageLocation: string): Promise<void> {
  try {
    await fs.unlink(resolveStorage(storageLocation));
  } catch {
    // best-effort: metadata deletion still proceeds
  }
}

/** A base64 data URL for an image file, or null for non-images/oversized. */
export async function readImagePreview(
  storageLocation: string,
  kind: FileKind,
): Promise<string | null> {
  if (!isImageKind(kind)) return null;
  const abs = resolveStorage(storageLocation);
  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    throw new FileError("file-missing", "The file is missing from the workspace.");
  }
  if (stat.size > MAX_PREVIEW_BYTES) return null;
  const bytes = await fs.readFile(abs);
  const mime = KIND_MIME[kind] ?? "application/octet-stream";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}
