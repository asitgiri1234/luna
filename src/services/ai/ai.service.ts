import type { AiChatMessage, ChatErrorCode } from "@shared/ai";

/**
 * Renderer-side AI service: the only module that talks to the chat IPC
 * bridge. The store consumes this; components never touch it.
 */

const SYSTEM_PROMPT =
  "You are Luna, a friendly and precise desktop AI assistant. " +
  "Answer concisely, use Markdown formatting, and use fenced code blocks with a language tag for code.";

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (cancelled: boolean) => void;
  onError: (code: ChatErrorCode, message: string) => void;
}

export interface GenerationHandle {
  requestId: string;
  cancel: () => void;
}

export const aiService = {
  /**
   * Starts a streaming generation for the given conversation and returns
   * a handle that can cancel it. Exactly one terminal callback fires
   * (`onDone` or `onError`), after which listeners are cleaned up.
   */
  streamChat(history: AiChatMessage[], callbacks: StreamCallbacks): GenerationHandle {
    const bridge = window.luna?.chat;
    if (!bridge) {
      queueMicrotask(() =>
        callbacks.onError(
          "unknown",
          "The desktop bridge is unavailable. Launch Luna through Electron (npm run dev).",
        ),
      );
      return { requestId: "", cancel: () => {} };
    }

    const requestId = crypto.randomUUID();
    const unsubscribe = bridge.onEvent((event) => {
      if (event.requestId !== requestId) return;
      switch (event.type) {
        case "token":
          callbacks.onToken(event.token);
          break;
        case "done":
          unsubscribe();
          callbacks.onDone(event.cancelled);
          break;
        case "error":
          unsubscribe();
          callbacks.onError(event.code, event.message);
          break;
      }
    });

    bridge.start({
      requestId,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    });

    return { requestId, cancel: () => bridge.cancel(requestId) };
  },
};
