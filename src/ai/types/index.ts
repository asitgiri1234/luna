import type { AiChatMessage, AiError, AiErrorCode, GenerationOptions } from "@shared/ai";

/**
 * # AI core types (renderer)
 *
 * Domain types used across `src/ai/`. Wire-level types (messages,
 * events, error codes) live in `shared/ai.ts` and are re-exported here
 * so the rest of the renderer imports everything from `@/ai/types`.
 */

export type {
  AiChatMessage,
  AiErrorCode,
  ChatRole,
  GenerationOptions,
  ProviderHealth,
} from "@shared/ai";

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** A provider-agnostic request for one completion. */
export interface GenerationRequest {
  model: string;
  messages: AiChatMessage[];
  options?: GenerationOptions;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (result: { cancelled: boolean }) => void;
  onError: (error: AiError) => void;
}

/** Returned by `AIProvider.stream` to control an in-flight generation. */
export interface GenerationHandle {
  requestId: string;
  cancel: () => void;
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

/** A message as the application (and UI) sees it. */
export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  /** Set when generation was stopped before the response finished. */
  interrupted?: boolean;
}

export type ConversationStatus = "idle" | "waiting" | "streaming" | "stopping";

export interface ConversationError {
  code: AiErrorCode;
  message: string;
}

/** Immutable snapshot emitted to conversation subscribers. */
export interface ConversationState {
  messages: ConversationMessage[];
  status: ConversationStatus;
  error: ConversationError | null;
}
