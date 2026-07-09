import {
  type DocumentChunk,
  type DocumentRecord,
  type VisionAnalysis,
  isDocumentKind,
} from "@shared/documents";
import { type FileRecord, isImageKind } from "@shared/files";

import { create } from "zustand";

import { aiCore } from "@/ai";
import { aiSettingsService } from "@/ai/settings/ai-settings.service";
import { documentService } from "@/documents/document.service";

/**
 * # Documents store — React adapter for the Document Intelligence layer
 *
 * Tracks, per source file, the structured document Luna has built from
 * it (or its processing / failed state), plus the currently opened
 * detail view. All work goes through `documentService`; no parsing or
 * SQL lives here. Processing is triggered lazily and is idempotent:
 * text documents are parsed, image files are OCR'd, each only once.
 */

export type DocPhase = "idle" | "processing" | "ready" | "failed";
export type DocMode = "process" | "ocr";

export interface DocEntry {
  phase: DocPhase;
  record: DocumentRecord | null;
  error?: string;
  /** How this file is turned into a document. */
  mode?: DocMode;
  /** 0…1 progress while OCR is running. */
  progress?: number;
}

export type VisionPhase = "idle" | "analyzing" | "ready" | "failed";

export interface VisionEntry {
  phase: VisionPhase;
  analysis: VisionAnalysis | null;
  progress?: number;
  error?: string;
}

interface DocumentsState {
  byFileId: Record<string, DocEntry>;
  /** Vision analysis state, keyed by image file id. */
  visionByFileId: Record<string, VisionEntry>;
  /** Chunks fetched on demand for the detail view, keyed by document id. */
  chunksByDoc: Record<string, DocumentChunk[]>;
  /** Source file id whose detail panel is open, if any. */
  selectedFileId: string | null;

  refresh: () => Promise<void>;
  /** Kicks off processing / OCR for any not-yet-handled files. */
  ensureProcessed: (files: FileRecord[]) => void;
  process: (sourceFileId: string, force?: boolean) => Promise<void>;
  /** Runs OCR for an image file. */
  ocr: (imageId: string) => Promise<void>;
  /** Runs vision analysis for an image file (background). */
  analyzeVision: (imageId: string) => Promise<void>;
  /** Loads a cached vision analysis for an image, if any. */
  loadVision: (imageId: string) => Promise<void>;
  dropForFile: (sourceFileId: string) => void;
  openDetail: (sourceFileId: string) => Promise<void>;
  closeDetail: () => void;
}

export const useDocumentsStore = create<DocumentsState>()((set, get) => {
  // Live OCR progress from the main process updates the matching entry.
  documentService.onOcrProgress(({ imageId, status, progress }) => {
    set((state) => {
      const entry = state.byFileId[imageId];
      const phase: DocPhase =
        status === "failed" ? "failed" : status === "done" ? (entry?.phase ?? "processing") : "processing";
      return {
        byFileId: {
          ...state.byFileId,
          [imageId]: { ...entry, phase, mode: "ocr", record: entry?.record ?? null, progress },
        },
      };
    });
  });

  // Live vision progress updates the matching vision entry.
  documentService.onVisionProgress(({ imageId, status, progress }) => {
    set((state) => {
      const entry = state.visionByFileId[imageId];
      const phase: VisionPhase =
        status === "failed" ? "failed" : status === "done" ? (entry?.phase ?? "analyzing") : "analyzing";
      return {
        visionByFileId: {
          ...state.visionByFileId,
          [imageId]: { ...entry, phase, analysis: entry?.analysis ?? null, progress },
        },
      };
    });
  });

  return {
    byFileId: {},
    visionByFileId: {},
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
        const entry = byFileId[file.id];
        if (entry && entry.phase !== "idle") continue;
        if (isDocumentKind(file.type)) void get().process(file.id);
        else if (isImageKind(file.type)) void get().ocr(file.id);
      }
    },

    process: async (sourceFileId, force = false) => {
      set((state) => ({
        byFileId: {
          ...state.byFileId,
          [sourceFileId]: {
            phase: "processing",
            mode: "process",
            record: state.byFileId[sourceFileId]?.record ?? null,
          },
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

    ocr: async (imageId) => {
      set((state) => ({
        byFileId: {
          ...state.byFileId,
          [imageId]: {
            phase: "processing",
            mode: "ocr",
            progress: 0,
            record: state.byFileId[imageId]?.record ?? null,
          },
        },
      }));
      try {
        const record = await documentService.ocrExtract(imageId);
        set((state) => ({
          byFileId: {
            ...state.byFileId,
            [imageId]: {
              phase: record.status === "ready" ? "ready" : "failed",
              mode: "ocr",
              progress: 1,
              record,
              error: record.error ?? undefined,
            },
          },
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "OCR failed.";
        set((state) => ({
          byFileId: {
            ...state.byFileId,
            [imageId]: { phase: "failed", mode: "ocr", record: null, error: message },
          },
        }));
      }
    },

    analyzeVision: async (imageId) => {
      set((state) => ({
        visionByFileId: {
          ...state.visionByFileId,
          [imageId]: {
            phase: "analyzing",
            progress: 0,
            analysis: state.visionByFileId[imageId]?.analysis ?? null,
          },
        },
      }));
      try {
        const analysis = await documentService.visionAnalyze(imageId);
        // Refresh any cached image-chat context so follow-ups use the new analysis.
        aiCore.imageChat.invalidate(imageId);
        set((state) => ({
          visionByFileId: {
            ...state.visionByFileId,
            [imageId]: { phase: "ready", analysis, progress: 1 },
          },
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Vision analysis failed.";
        set((state) => ({
          visionByFileId: {
            ...state.visionByFileId,
            [imageId]: { phase: "failed", analysis: null, error: message },
          },
        }));
      }
    },

    loadVision: async (imageId) => {
      if (get().visionByFileId[imageId]) return;
      try {
        const analysis = await documentService.visionGet(imageId);
        if (analysis) {
          set((state) => ({
            visionByFileId: {
              ...state.visionByFileId,
              [imageId]: { phase: "ready", analysis },
            },
          }));
        } else if (aiSettingsService.getAISettings().defaultVisionAnalysis) {
          // "Default Vision Analysis" on: analyze an un-analyzed image now.
          void get().analyzeVision(imageId);
        }
      } catch {
        // Absence of a cached analysis is not an error.
      }
    },

    dropForFile: (sourceFileId) =>
      set((state) => {
        const byFileId = { ...state.byFileId };
        const visionByFileId = { ...state.visionByFileId };
        delete byFileId[sourceFileId];
        delete visionByFileId[sourceFileId];
        return {
          byFileId,
          visionByFileId,
          selectedFileId: state.selectedFileId === sourceFileId ? null : state.selectedFileId,
        };
      }),

    openDetail: async (sourceFileId) => {
      set({ selectedFileId: sourceFileId });
      void get().loadVision(sourceFileId); // surface any cached image analysis
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
  };
});
