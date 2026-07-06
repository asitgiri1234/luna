import { create } from "zustand";

import { aiCore } from "@/ai";
import type {
  ConversationError,
  ConversationMessage,
  ConversationStatus,
} from "@/ai/types";

/**
 * # Chat store — React adapter for the conversation manager
 *
 * A thin zustand mirror of `ConversationManager` state so components
 * can subscribe with selectors. Contains **no business logic**: every
 * action delegates to the manager in `src/ai/conversation/`, and every
 * manager state change is mirrored back in.
 *
 * The store keeps the same public shape it has had since milestone 2,
 * so UI components are untouched by the AI-core refactor.
 */

export type ChatMessage = ConversationMessage;
export type ChatStatus = ConversationStatus;
export type ChatError = ConversationError;

interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  error: ChatError | null;
  sendMessage: (content: string) => void;
  stopGeneration: () => void;
  regenerate: () => void;
  newChat: () => void;
  dismissError: () => void;
}

const conversation = aiCore.conversation;

export const useChatStore = create<ChatState>()((set) => {
  conversation.subscribe((state) =>
    set({ messages: state.messages, status: state.status, error: state.error }),
  );

  return {
    ...conversation.getState(),
    sendMessage: (content) => conversation.send(content),
    stopGeneration: () => conversation.stop(),
    regenerate: () => conversation.regenerate(),
    newChat: () => conversation.reset(),
    dismissError: () => conversation.dismissError(),
  };
});
