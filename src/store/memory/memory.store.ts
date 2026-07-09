import type { MemoryCandidate, MemoryCategory, MemoryRecord } from "@shared/memory";

import { create } from "zustand";

import { aiCore } from "@/ai";

/**
 * # Memory store — React adapter for the memory engine
 *
 * Holds two things the UI renders: the queue of pending approval
 * candidates, and the catalog of saved memories for the Memory page.
 * Contains no persistence logic — every action delegates to the
 * `MemoryService`, and the list refreshes whenever the service reports
 * a change.
 */

export interface PendingCandidate extends MemoryCandidate {
  /** Client-side id to track the card across a decision. */
  localId: string;
}

export type MemoryListStatus = "loading" | "ready" | "unavailable";
export type CategoryFilter = MemoryCategory | "all";

interface MemoryUiState {
  candidates: PendingCandidate[];
  memories: MemoryRecord[];
  query: string;
  categoryFilter: CategoryFilter;
  showArchived: boolean;
  status: MemoryListStatus;

  // Approval-card decisions
  approve: (localId: string) => Promise<void>;
  ignore: (localId: string) => void;
  alwaysSimilar: (localId: string) => Promise<void>;
  neverSimilar: (localId: string) => Promise<void>;

  // Memory-page operations
  refresh: () => Promise<void>;
  /** Search saved memories by key/value (updates the query + refreshes). */
  searchMemories: (query: string) => void;
  setCategoryFilter: (filter: CategoryFilter) => void;
  setShowArchived: (show: boolean) => void;
  editMemory: (
    id: string,
    patch: { category?: MemoryCategory; key?: string; value?: string },
  ) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  archiveMemory: (id: string) => Promise<void>;
  unarchiveMemory: (id: string) => Promise<void>;
}

const memory = aiCore.memory;

export const useMemoryStore = create<MemoryUiState>()((set, get) => {
  const take = (localId: string): PendingCandidate | undefined => {
    const candidate = get().candidates.find((c) => c.localId === localId);
    set({ candidates: get().candidates.filter((c) => c.localId !== localId) });
    return candidate;
  };

  return {
    candidates: [],
    memories: [],
    query: "",
    categoryFilter: "all",
    showArchived: false,
    status: "loading",

    approve: async (localId) => {
      const candidate = take(localId);
      if (candidate) await memory.approve(candidate);
    },

    ignore: (localId) => {
      take(localId);
    },

    alwaysSimilar: async (localId) => {
      const candidate = take(localId);
      if (candidate) await memory.alwaysRememberSimilar(candidate);
    },

    neverSimilar: async (localId) => {
      const candidate = take(localId);
      if (candidate) await memory.neverRememberSimilar(candidate);
    },

    refresh: async () => {
      try {
        const { query } = get();
        const memories = query.trim()
          ? await memory.searchMemories(query)
          : await memory.listMemories();
        set({ memories, status: "ready" });
      } catch {
        set({ status: "unavailable", memories: [] });
      }
    },

    searchMemories: (query) => {
      set({ query });
      void get().refresh();
    },

    setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
    setShowArchived: (showArchived) => set({ showArchived }),

    editMemory: async (id, patch) => {
      await memory.updateMemory({ id, ...patch });
    },

    deleteMemory: async (id) => {
      await memory.deleteMemory(id);
    },

    archiveMemory: async (id) => {
      await memory.archiveMemory(id, true);
    },

    unarchiveMemory: async (id) => {
      await memory.archiveMemory(id, false);
    },
  };
});

// New candidates from the extractor arrive here for the approval cards.
memory.onCandidate((candidate) => {
  useMemoryStore.setState((state) => ({
    candidates: [...state.candidates, { ...candidate, localId: crypto.randomUUID() }],
  }));
});

// Any change to the stored set refreshes the page list.
memory.onMemoriesChanged(() => {
  void useMemoryStore.getState().refresh();
});
queueMicrotask(() => {
  void useMemoryStore.getState().refresh();
});
