/**
 * # Shared files contract
 *
 * Wire types for the File Upload Infrastructure, crossing IPC between
 * the renderer's file layer (`src/files/`) and the main-process
 * workspace + repository (`electron/files/`). Free of imports from
 * either side.
 *
 * Files are COPIED into the Luna Workspace; metadata lives in SQLite and
 * `storageLocation` is always relative to the workspace root (never an
 * absolute path).
 */

// ---------------------------------------------------------------------------
// Supported file kinds
// ---------------------------------------------------------------------------

export type FileKind = "pdf" | "docx" | "txt" | "md" | "png" | "jpeg" | "webp";

export const IMAGE_KINDS: readonly FileKind[] = ["png", "jpeg", "webp"];

/** Extension (with dot, lowercase) → canonical kind. */
export const EXTENSION_KINDS: Record<string, FileKind> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
  ".md": "md",
  ".markdown": "md",
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".webp": "webp",
};

/** Accepted extensions, for the file picker + drag-drop validation. */
export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_KINDS).map((ext) => ext.slice(1));

/** MIME types for image previews (data URLs). */
export const KIND_MIME: Partial<Record<FileKind, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Refuse files larger than this (keeps copies + previews bounded). */
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function isImageKind(kind: FileKind): boolean {
  return IMAGE_KINDS.includes(kind);
}

// ---------------------------------------------------------------------------
// Records / inputs
// ---------------------------------------------------------------------------

export interface FileRecord {
  id: string;
  filename: string;
  type: FileKind;
  size: number;
  createdAt: number;
  updatedAt: number;
  hash: string;
  /** Path relative to the workspace root, e.g. "files/<id>.pdf". */
  storageLocation: string;
}

export interface ImportFileInput {
  /** Client id correlating progress events to this import. */
  uploadId: string;
  /** Absolute source path (from the picker or drag-drop). */
  sourcePath: string;
}

export interface ImportFileResult {
  file: FileRecord;
  /** True when an identical file (same hash) already existed. */
  duplicate: boolean;
}

export interface RenameFileInput {
  id: string;
  filename: string;
}

export interface FilePreview {
  /** Image data URL, or null for non-image kinds / oversized images. */
  dataUrl: string | null;
}

/** Progress event streamed while a file is copied into the workspace. */
export interface FileProgress {
  uploadId: string;
  loaded: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Errors / results
// ---------------------------------------------------------------------------

export type FileErrorCode =
  | "unsupported-type"
  | "too-large"
  | "file-missing"
  | "db-unavailable"
  | "not-found"
  | "unknown";

export class FileError extends Error {
  constructor(
    public readonly code: FileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FileError";
  }
}

export type FileOpResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: FileErrorCode; message: string };

// ---------------------------------------------------------------------------
// IPC channels
// ---------------------------------------------------------------------------

export const FILE_CHANNELS = {
  pick: "files:pick",
  import: "files:import",
  list: "files:list",
  rename: "files:rename",
  remove: "files:delete",
  preview: "files:preview",
  open: "files:open",
  reveal: "files:reveal",
  progress: "files:progress",
} as const;
