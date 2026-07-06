/**
 * Shared contract between the renderer and the Electron main process.
 * This file is included by both TypeScript projects — keep it free of
 * imports from either side.
 */

/** The Ollama model Luna talks to. Change it here and nowhere else. */
export const AI_MODEL = "qwen2.5:3b";

export type ChatRole = "system" | "user" | "assistant";

/** Wire format of a single conversation turn sent to the model. */
export interface AiChatMessage {
  role: ChatRole;
  content: string;
}

export type ChatErrorCode =
  | "ollama-not-installed"
  | "ollama-not-running"
  | "model-not-found"
  | "timeout"
  | "unknown";

export interface ChatStartPayload {
  requestId: string;
  messages: AiChatMessage[];
}

/** Events streamed from the main process for one generation request. */
export type ChatStreamEvent =
  | { requestId: string; type: "token"; token: string }
  | { requestId: string; type: "done"; cancelled: boolean }
  | { requestId: string; type: "error"; code: ChatErrorCode; message: string };

export const CHAT_CHANNELS = {
  start: "chat:start",
  cancel: "chat:cancel",
  event: "chat:event",
} as const;
