import type { ConversationMeta } from "@shared/conversations";

import { create } from "zustand";

import { aiCore } from "@/ai";

/**
 * # Conversation store — React adapter for the conversation list
 *
 * Mirrors the saved-conversation list for the sidebar and history
 * page. Separate from the chat store by design: the chat store tracks
 * the *active thread's* messages, this one tracks the *catalog* of
 * threads.
 *
 * Contains no persistence logic — every action delegates to the
 * conversation manager (which owns the repository), and the store
 * refreshes whenever the manager reports a change (new conversation,
 * saved message, auto-title, …).
 */

export type ConversationListStatus = "loading" | "ready" | "unavailable";

interface ConversationsUiState {
  conversations: ConversationMeta[];
  activeId: string | null;
  query: string;
  status: ConversationListStatus;
  refresh: () => Promise<void>;
  select: (id: string) => Promise<void>;
  startNew: () => void;
  remove: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  setQuery: (query: string) => void;
}

const manager = aiCore.conversation;

export const useConversationStore = create<ConversationsUiState>()((set, get) => ({
  conversations: [],
  activeId: null,
  query: "",
  status: "loading",

  refresh: async () => {
    try {
      const conversations = await manager.listConversations();
      set({
        conversations,
        status: "ready",
        activeId: manager.getActiveConversationId(),
      });
    } catch {
      set({ status: "unavailable", conversations: [] });
    }
  },

  select: async (id) => {
    if (get().activeId === id) return;
    await manager.selectConversation(id);
    set({ activeId: id });
  },

  startNew: () => {
    manager.reset();
    set({ activeId: null });
  },

  remove: async (id) => {
    await manager.deleteConversation(id);
    if (get().activeId === id) set({ activeId: null });
  },

  rename: async (id, title) => {
    await manager.renameConversation(id, title);
  },

  togglePin: async (id) => {
    const target = get().conversations.find((c) => c.id === id);
    if (target) await manager.pinConversation(id, !target.isPinned);
  },

  setQuery: (query) => set({ query }),
}));

// The manager announces every persisted change (new rows, previews,
// auto-titles); keep the list in sync and load it once at startup.
manager.onConversationsChanged(() => {
  void useConversationStore.getState().refresh();
});
queueMicrotask(() => {
  void useConversationStore.getState().refresh();
});
