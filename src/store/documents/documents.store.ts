import { type DocumentChunk, type DocumentRecord, isDocumentKind } from "@shared/documents";
import type { FileRecord } from "@shared/files";

import { create } from "zustand";

import { documentService } from "@/documents/document.service";

/**
 * # Documents store — React adapter for the Document Intelligence layer
 *
 * Tracks, per source file, the structured document Luna has built from
 * it (or its processing / failed state), plus the currently opened
 * detail view. All work goes through `documentService`; no parsing or
 * SQL lives here. Processing is triggered lazily for document-kind files
 * and is idempotent — a file is only processed once unless re-run.
 */

export type DocPhase = "idle" | "processing" | "ready" | "failed";

export interface DocEntry {
  phase: DocPhase;
  record: DocumentRecord | null;
  error?: string;
}

interface DocumentsState {
  byFileId: Record<string, DocEntry>;
  /** Chunks fetched on demand for the detail view, keyed by document id. */
  chunksByDoc: Record<string, DocumentChunk[]>;
  /** Source file id whose detail panel is open, if any. */
  selectedFileId: string | null;

  refresh: () => Promise<void>;
  /** Kicks off processing for any not-yet-processed document files. */
  ensureProcessed: (files: FileRecord[]) => void;
  process: (sourceFileId: string, force?: boolean) => Promise<void>;
  dropForFile: (sourceFileId: string) => void;
  openDetail: (sourceFileId: string) => Promise<void>;
  closeDetail: () => void;
}

export const useDocumentsStore = create<DocumentsState>()((set, get) => ({
  byFileId: {},
  chunksByDoc: {},
  selectedFileId: null,

  refresh: async () => {
    try {
      const records = await documentService.list();
      const byFileId: Record<string, DocEntry> = {};
      for (const record of records) {
        byFileId[record.sourceFileId] = {
          phase: record.status === "ready" ? "ready" : "failed",
          record,
          error: record.error ?? undefined,
        };
      }
      // Preserve in-flight "processing" entries not yet in the DB list.
      set((state) => {
        for (const [fileId, entry] of Object.entries(state.byFileId)) {
          if (entry.phase === "processing" && !byFileId[fileId]) byFileId[fileId] = entry;
        }
        return { byFileId };
      });
    } catch {
      // Leave existing state; the Files page still works without documents.
    }
  },

  ensureProcessed: (files) => {
    const { byFileId } = get();
    for (const file of files) {
      if (!isDocumentKind(file.type)) continue;
      const entry = byFileId[file.id];
      if (!entry || entry.phase === "idle") void get().process(file.id);
    }
  },

  process: async (sourceFileId, force = false) => {
    set((state) => ({
      byFileId: {
        ...state.byFileId,
        [sourceFileId]: { phase: "processing", record: state.byFileId[sourceFileId]?.record ?? null },
      },
    }));
    try {
      const record = await documentService.process({ sourceFileId, force });
      set((state) => ({
        byFileId: {
          ...state.byFileId,
          [sourceFileId]: {
            phase: record.status === "ready" ? "ready" : "failed",
            record,
            error: record.error ?? undefined,
          },
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Processing failed.";
      set((state) => ({
        byFileId: {
          ...state.byFileId,
          [sourceFileId]: { phase: "failed", record: null, error: message },
        },
      }));
    }
  },

  dropForFile: (sourceFileId) =>
    set((state) => {
      const byFileId = { ...state.byFileId };
      delete byFileId[sourceFileId];
      return {
        byFileId,
        selectedFileId: state.selectedFileId === sourceFileId ? null : state.selectedFileId,
      };
    }),

  openDetail: async (sourceFileId) => {
    set({ selectedFileId: sourceFileId });
    const record = get().byFileId[sourceFileId]?.record;
    if (!record || record.status !== "ready" || get().chunksByDoc[record.id]) return;
    try {
      const chunks = await documentService.chunks(record.id);
      set((state) => ({ chunksByDoc: { ...state.chunksByDoc, [record.id]: chunks } }));
    } catch {
      // Detail view degrades to metadata-only if chunks can't be loaded.
    }
  },

  closeDetail: () => set({ selectedFileId: null }),
}));
