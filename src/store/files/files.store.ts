import { type FileKind, type FileRecord, isImageKind } from "@shared/files";

import { create } from "zustand";

import { fileService } from "@/files/file.service";

/**
 * # Files store — React adapter for the file layer
 *
 * Holds the uploaded-file catalog plus live upload progress, and the
 * view state (search / sort / filter). All persistence goes through
 * `fileService`; no filesystem or SQL logic lives here.
 */

export type SortKey = "createdAt" | "name" | "size";
export type SortDir = "asc" | "desc";
export type FileFilter = "all" | "documents" | "images";
export type ListStatus = "loading" | "ready" | "unavailable";

export type UploadStatus = "uploading" | "done" | "duplicate" | "error";

export interface UploadItem {
  uploadId: string;
  filename: string;
  loaded: number;
  total: number;
  status: UploadStatus;
  error?: string;
}

interface FilesUiState {
  files: FileRecord[];
  uploads: UploadItem[];
  query: string;
  sortKey: SortKey;
  sortDir: SortDir;
  filter: FileFilter;
  status: ListStatus;

  refresh: () => Promise<void>;
  /** Imports files from absolute paths (picker or drag-drop). */
  importPaths: (items: { path: string; name: string }[]) => Promise<void>;
  pickAndImport: () => Promise<void>;
  rename: (id: string, filename: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  open: (id: string) => Promise<void>;
  reveal: (id: string) => Promise<void>;
  setQuery: (query: string) => void;
  setSort: (key: SortKey) => void;
  setFilter: (filter: FileFilter) => void;
  dismissUpload: (uploadId: string) => void;
}

function matchesFilter(kind: FileKind, filter: FileFilter): boolean {
  if (filter === "all") return true;
  return filter === "images" ? isImageKind(kind) : !isImageKind(kind);
}

export const useFilesStore = create<FilesUiState>()((set, get) => {
  // Live progress from the main process updates the matching upload row.
  fileService.onProgress(({ uploadId, loaded, total }) => {
    set((state) => ({
      uploads: state.uploads.map((upload) =>
        upload.uploadId === uploadId ? { ...upload, loaded, total } : upload,
      ),
    }));
  });

  return {
    files: [],
    uploads: [],
    query: "",
    sortKey: "createdAt",
    sortDir: "desc",
    filter: "all",
    status: "loading",

    refresh: async () => {
      try {
        set({ files: await fileService.list(), status: "ready" });
      } catch {
        set({ files: [], status: "unavailable" });
      }
    },

    importPaths: async (items) => {
      if (items.length === 0) return;
      const newUploads: UploadItem[] = items.map((item) => ({
        uploadId: crypto.randomUUID(),
        filename: item.name,
        loaded: 0,
        total: 0,
        status: "uploading",
      }));
      set((state) => ({ uploads: [...state.uploads, ...newUploads] }));

      await Promise.all(
        newUploads.map(async (upload, index) => {
          try {
            const result = await fileService.import(upload.uploadId, items[index].path);
            set((state) => ({
              uploads: state.uploads.map((u) =>
                u.uploadId === upload.uploadId
                  ? { ...u, status: result.duplicate ? "duplicate" : "done", loaded: u.total || 1 }
                  : u,
              ),
            }));
          } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed.";
            set((state) => ({
              uploads: state.uploads.map((u) =>
                u.uploadId === upload.uploadId ? { ...u, status: "error", error: message } : u,
              ),
            }));
          }
        }),
      );
      await get().refresh();
      // Auto-clear finished uploads after a moment.
      setTimeout(() => {
        set((state) => ({
          uploads: state.uploads.filter((u) => u.status === "uploading" || u.status === "error"),
        }));
      }, 2500);
    },

    pickAndImport: async () => {
      const paths = await fileService.pick().catch(() => [] as string[]);
      await get().importPaths(
        paths.map((path) => ({ path, name: path.split(/[\\/]/).pop() ?? path })),
      );
    },

    rename: async (id, filename) => {
      await fileService.rename(id, filename);
      await get().refresh();
    },

    remove: async (id) => {
      await fileService.remove(id);
      set((state) => ({ files: state.files.filter((file) => file.id !== id) }));
    },

    open: async (id) => {
      await fileService.open(id).catch(() => {});
    },

    reveal: async (id) => {
      await fileService.reveal(id).catch(() => {});
    },

    setQuery: (query) => set({ query }),
    setFilter: (filter) => set({ filter }),
    setSort: (key) =>
      set((state) =>
        state.sortKey === key
          ? { sortDir: state.sortDir === "asc" ? "desc" : "asc" }
          : { sortKey: key, sortDir: key === "name" ? "asc" : "desc" },
      ),

    dismissUpload: (uploadId) =>
      set((state) => ({ uploads: state.uploads.filter((u) => u.uploadId !== uploadId) })),
  };
});

/**
 * Pure derivation of the visible, filtered, sorted list. Called inside a
 * `useMemo` (NOT as a zustand selector) so it never returns a fresh
 * array on every store read.
 */
export function computeVisibleFiles(
  files: FileRecord[],
  view: { query: string; sortKey: SortKey; sortDir: SortDir; filter: FileFilter },
): FileRecord[] {
  const needle = view.query.trim().toLowerCase();
  const filtered = files.filter(
    (file) =>
      matchesFilter(file.type, view.filter) &&
      (!needle || file.filename.toLowerCase().includes(needle)),
  );
  const dir = view.sortDir === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    if (view.sortKey === "name") return a.filename.localeCompare(b.filename) * dir;
    if (view.sortKey === "size") return (a.size - b.size) * dir;
    return (a.createdAt - b.createdAt) * dir;
  });
}
