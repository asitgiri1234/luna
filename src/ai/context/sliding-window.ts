import type { AiChatMessage } from "@/ai/types";
import { createLogger } from "@shared/logger";

import type { ContextManager, ContextWindow } from "./context-manager";

/**
 * # Sliding-window context manager
 *
 * Baseline `ContextManager`: estimates tokens with a chars/4 heuristic
 * (good enough for window budgeting; a real tokenizer can replace it
 * behind the same interface) and, when the conversation outgrows the
 * window, drops the oldest non-system turns first.
 */

const CHARS_PER_TOKEN = 4;
/** Rough per-message overhead for role markers and separators. */
const MESSAGE_OVERHEAD_TOKENS = 4;

const log = createLogger("ai:context");

export class SlidingWindowContextManager implements ContextManager {
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  estimateMessages(messages: AiChatMessage[]): number {
    return messages.reduce(
      (sum, message) => sum + this.estimateTokens(message.content) + MESSAGE_OVERHEAD_TOKENS,
      0,
    );
  }

  fitToWindow(messages: AiChatMessage[], window: ContextWindow): AiChatMessage[] {
    const budget = window.contextLength - window.reservedForResponse;
    if (this.estimateMessages(messages) <= budget) return messages;

    const system = messages[0]?.role === "system" ? messages[0] : null;
    const turns = system ? messages.slice(1) : [...messages];

    // Drop oldest turns until we fit, but never the final (current) one.
    while (turns.length > 1) {
      const candidate = system ? [system, ...turns] : turns;
      if (this.estimateMessages(candidate) <= budget) break;
      turns.shift();
    }

    const fitted = system ? [system, ...turns] : turns;
    log.debug("trimmed conversation to fit context window", {
      before: messages.length,
      after: fitted.length,
      budgetTokens: budget,
    });
    return fitted;
  }
}
