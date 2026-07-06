import type { AiChatMessage, ChatErrorCode } from "@shared/ai";

import { create } from "zustand";

import { type GenerationHandle, aiService } from "@/services/ai/ai.service";

export type ChatStatus = "idle" | "waiting" | "streaming" | "stopping";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  /** Set when generation was stopped before the response finished. */
  interrupted?: boolean;
}

export interface ChatError {
  code: ChatErrorCode;
  message: string;
}

interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  error: ChatError | null;
  sendMessage: (content: string) => void;
  stopGeneration: () => void;
  /** Re-runs the last exchange (drops the last assistant reply, if any). */
  regenerate: () => void;
  newChat: () => void;
  dismissError: () => void;
}

// ---------------------------------------------------------------------------
// Module-private generation plumbing (not part of the reactive state).
//
// Tokens arrive over IPC far faster than the UI should re-render, so they
// accumulate in `tokenBuffer` and flush at most once per animation frame.
// ---------------------------------------------------------------------------

let activeHandle: GenerationHandle | null = null;
let tokenBuffer = "";
let flushScheduled = false;

function makeId(): string {
  return crypto.randomUUID();
}

export const useChatStore = create<ChatState>()((set, get) => {
  function flushTokens(): void {
    flushScheduled = false;
    if (!tokenBuffer) return;
    const text = tokenBuffer;
    tokenBuffer = "";
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (!last || last.role !== "assistant") return state;
      messages[messages.length - 1] = { ...last, content: last.content + text };
      return { messages, status: state.status === "waiting" ? "streaming" : state.status };
    });
  }

  function scheduleFlush(): void {
    if (flushScheduled) return;
    flushScheduled = true;
    // rAF keeps updates frame-aligned; fall back to a timer when hidden
    // (browsers suspend rAF for background windows).
    if (document.visibilityState === "visible") {
      requestAnimationFrame(flushTokens);
    } else {
      setTimeout(flushTokens, 50);
    }
  }

  /** Starts streaming a reply to the current history (which must end with a user turn). */
  function startGeneration(): void {
    const history: AiChatMessage[] = get().messages.map(({ role, content }) => ({
      role,
      content,
    }));

    set((state) => ({
      status: "waiting",
      error: null,
      messages: [
        ...state.messages,
        { id: makeId(), role: "assistant", content: "", createdAt: Date.now() },
      ],
    }));

    activeHandle = aiService.streamChat(history, {
      onToken: (token) => {
        tokenBuffer += token;
        scheduleFlush();
      },
      onDone: (cancelled) => {
        flushTokens();
        activeHandle = null;
        set((state) => {
          const messages = [...state.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            if (last.content === "") {
              // Nothing arrived (e.g. stopped before the first token).
              messages.pop();
            } else if (cancelled) {
              messages[messages.length - 1] = { ...last, interrupted: true };
            }
          }
          return { messages, status: "idle" };
        });
      },
      onError: (code, message) => {
        flushTokens();
        activeHandle = null;
        set((state) => {
          const messages = [...state.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant" && last.content === "") messages.pop();
          return { messages, status: "idle", error: { code, message } };
        });
      },
    });
  }

  return {
    messages: [],
    status: "idle",
    error: null,

    sendMessage: (content) => {
      const text = content.trim();
      if (!text || get().status !== "idle") return;
      set((state) => ({
        error: null,
        messages: [
          ...state.messages,
          { id: makeId(), role: "user", content: text, createdAt: Date.now() },
        ],
      }));
      startGeneration();
    },

    stopGeneration: () => {
      const { status } = get();
      if (status !== "waiting" && status !== "streaming") return;
      set({ status: "stopping" });
      activeHandle?.cancel();
    },

    regenerate: () => {
      const { status, messages } = get();
      if (status !== "idle") return;
      const trimmed = [...messages];
      if (trimmed[trimmed.length - 1]?.role === "assistant") trimmed.pop();
      if (trimmed[trimmed.length - 1]?.role !== "user") return;
      set({ messages: trimmed, error: null });
      startGeneration();
    },

    newChat: () => {
      activeHandle?.cancel();
      activeHandle = null;
      tokenBuffer = "";
      set({ messages: [], status: "idle", error: null });
    },

    dismissError: () => set({ error: null }),
  };
});
