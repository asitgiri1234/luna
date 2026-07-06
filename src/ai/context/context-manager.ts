import type { AiChatMessage } from "@/ai/types";

/**
 * # Context manager interface
 *
 * Owns the question "what fits in the model's context window?".
 * Consumers (the conversation manager today, memory retrieval and file
 * understanding later) describe the window; the context manager decides
 * what survives.
 *
 * ## Extension point
 * The summarization milestone adds an implementation whose
 * `fitToWindow` compresses overflow into a summary message instead of
 * dropping it. Because consumers depend on this interface, that swap
 * happens in the composition root only.
 */

export interface ContextWindow {
  /** Total context length of the model, in tokens. */
  contextLength: number;
  /** Tokens to keep free for the model's response. */
  reservedForResponse: number;
}

export interface ContextManager {
  /** Cheap token estimate for a piece of text (no tokenizer dependency). */
  estimateTokens(text: string): number;

  /** Token estimate for a full message list, including per-message overhead. */
  estimateMessages(messages: AiChatMessage[]): number;

  /**
   * Returns the subset of `messages` that fits the window. Must always
   * keep the leading system message (if any) and the final message.
   */
  fitToWindow(messages: AiChatMessage[], window: ContextWindow): AiChatMessage[];
}
