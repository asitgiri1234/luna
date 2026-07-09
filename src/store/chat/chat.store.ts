import { create } from "zustand";

import { aiCore } from "@/ai";
import type { Citation } from "@/ai/documents/citation.types";
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

/** The image the current conversation is discussing, if any. */
export interface CurrentImage {
  id: string;
  filename: string;
}

interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  error: ChatError | null;
  /** "Chat With Documents" toggle — grounds answers in uploaded documents. */
  documentMode: boolean;
  /** The image being discussed (image chat), if any. */
  currentImage: CurrentImage | null;
  sendMessage: (content: string) => void;
  stopGeneration: () => void;
  regenerate: () => void;
  newChat: () => void;
  dismissError: () => void;
  setDocumentMode: (enabled: boolean) => void;
  /** Opens the source document for a citation. */
  openCitation: (citation: Citation) => void;
  /** Starts (or clears) image chat for a given image. */
  setImageContext: (image: CurrentImage | null) => void;
}

const conversation = aiCore.conversation;

export const useChatStore = create<ChatState>()((set) => {
  conversation.subscribe((state) =>
    set({ messages: state.messages, status: state.status, error: state.error }),
  );

  return {
    ...conversation.getState(),
    documentMode: conversation.isDocumentMode(),
    currentImage: null,
    sendMessage: (content) => conversation.send(content),
    stopGeneration: () => conversation.stop(),
    regenerate: () => conversation.regenerate(),
    newChat: () => {
      conversation.reset();
      set({ currentImage: null });
    },
    dismissError: () => conversation.dismissError(),
    setDocumentMode: (enabled) => {
      conversation.setDocumentMode(enabled);
      set({ documentMode: enabled });
    },
    openCitation: (citation) => void aiCore.documentChat.openCitation(citation),
    setImageContext: (image) => {
      conversation.setImageContext(image?.id ?? null);
      set({ currentImage: image });
    },
  };
});
