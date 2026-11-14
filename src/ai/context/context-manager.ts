import type { AiChatMessage } from "@/ai/types";

/**
 * # Context manager interface
 *
 * Owns the question "what fits in the model's context window?".
 * Consumers (the conversation manager today) describe the window; the
 * context manager decides what survives.
 *
 * `fitToWindow` is async because a summary is a model call. The
 * summarizing implementation compresses overflow into one summary
 * message. `SlidingWindowContextManager` drops that overflow instead,
 * and stays as the fallback when a summary cannot be produced. The
 * concrete manager is chosen in the composition root.
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
   * Returns messages that fit the window. Must always keep the leading
   * system message (if any) and the final message. When the conversation
   * already fits, the same list comes back unchanged.
   */
  fitToWindow(messages: AiChatMessage[], window: ContextWindow): Promise<AiChatMessage[]>;
}
