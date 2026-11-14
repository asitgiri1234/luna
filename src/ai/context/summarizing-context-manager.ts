import type { AIProvider } from "@/ai/provider/ai-provider";
import type { AiChatMessage } from "@/ai/types";
import { createLogger } from "@shared/logger";

import type { ContextManager, ContextWindow } from "./context-manager";

/**
 * # Summarizing context manager
 *
 * When the conversation fits in the window, it is returned unchanged and
 * the model is not called. When it does not, the oldest turns that do
 * not fit — the overflow — are compressed into one summary message.
 * The leading system prompt and the latest turn are always kept, along
 * with as many recent turns as still fit beside the summary.
 *
 * A summary is a model call through the injected provider (the same
 * Ollama provider the rest of the core uses). If Local AI is turned
 * off, or the call fails, or the summary still does not fit, the
 * fallback manager (the sliding window) trims the conversation instead
 * so the reply can still be sent.
 */

/** Cap on the summary body. Keeps the replacement smaller than a long history. */
const MAX_SUMMARY_TOKENS = 512;
/**
 * Smallest summary body worth a model call. Below this there is no room
 * beside the system prompt and the turns we still keep, so another old
 * turn is moved into the overflow. If the whole prefix still cannot
 * free this much room, the sliding window drops it instead.
 */
const MIN_SUMMARY_TOKENS = 32;
const SUMMARY_TEMPERATURE = 0.2;

const SUMMARY_SYSTEM_PROMPT = `You compress earlier turns of a conversation so they still fit in the context window.
Write a concise factual summary of the transcript. Keep names, decisions, numbers, and unresolved questions.
Plain prose only. Do not invent facts. Do not answer the user or continue the conversation.`;

const SUMMARY_HEADER =
  "Summary of the earlier conversation (older messages were compressed to fit the context window):";

const log = createLogger("ai:context:summary");

export interface SummarizingContextOptions {
  provider: AIProvider;
  /** Current model id. Read per summary so a settings change applies on the next turn. */
  getModel: () => string;
  /** Used when the conversation fits, and whenever a summary cannot be produced. */
  fallback: ContextManager;
  /**
   * Local AI privacy toggle. A summary is a model call: `false` skips
   * it and the fallback drops the overflow instead.
   */
  isLocalAiAllowed: () => Promise<boolean>;
}

interface SummaryPlan {
  system: AiChatMessage | null;
  overflow: AiChatMessage[];
  /** Recent turns that remain verbatim. Always ends with the latest message. */
  kept: AiChatMessage[];
  /** Token budget for the summary body, sized to the space the overflow frees. */
  summaryTokens: number;
}

export class SummarizingContextManager implements ContextManager {
  constructor(private readonly options: SummarizingContextOptions) {}

  estimateTokens(text: string): number {
    return this.options.fallback.estimateTokens(text);
  }

  estimateMessages(messages: AiChatMessage[]): number {
    return this.options.fallback.estimateMessages(messages);
  }

  async fitToWindow(messages: AiChatMessage[], window: ContextWindow): Promise<AiChatMessage[]> {
    const budget = window.contextLength - window.reservedForResponse;
    if (this.estimateMessages(messages) <= budget) return messages;

    const plan = this.plan(messages, budget);
    if (!plan) return this.options.fallback.fitToWindow(messages, window);

    try {
      const allowed = await this.options.isLocalAiAllowed();
      if (!allowed) {
        log.debug("skipping summary; Local AI is off");
        return this.options.fallback.fitToWindow(messages, window);
      }

      const summary = await this.summarize(plan.overflow, window, plan.summaryTokens);
      const trimmed = this.trimToTokens(summary, plan.summaryTokens);
      if (!trimmed) return this.options.fallback.fitToWindow(messages, window);

      const fitted = this.assemble(plan, trimmed);
      if (this.estimateMessages(fitted) > budget) {
        log.warn("summary did not fit the window; using sliding window");
        return this.options.fallback.fitToWindow(messages, window);
      }

      log.debug("compressed overflow into a summary", {
        before: messages.length,
        after: fitted.length,
        overflow: plan.overflow.length,
      });
      return fitted;
    } catch (error) {
      log.warn("summary failed; using sliding window", { error: String(error) });
      return this.options.fallback.fitToWindow(messages, window);
    }
  }

  /**
   * Grows the overflow from the oldest turn until a summary of it fits
   * beside the system prompt, the latest turn, and any newer turns that
   * still have room. The summary is capped, so a long overflow becomes
   * one short message instead of a paraphrase the same size as the
   * history it replaces. Returns null when there is nothing to compress
   * or no room for even a short summary — the caller then drops instead.
   */
  private plan(messages: AiChatMessage[], budget: number): SummaryPlan | null {
    const system = messages[0]?.role === "system" ? messages[0] : null;
    const turns = system ? messages.slice(1) : messages;
    if (turns.length <= 1) return null;

    const latest = turns[turns.length - 1];
    if (!latest) return null;
    const earlier = turns.slice(0, -1);
    const headerTokens = this.estimateMessages([
      { role: "system", content: `${SUMMARY_HEADER}\n` },
    ]);

    for (let count = 1; count <= earlier.length; count++) {
      const overflow = earlier.slice(0, count);
      const kept = [...earlier.slice(count), latest];
      const anchor = system ? [system, ...kept] : kept;
      const bodyBudget = budget - this.estimateMessages(anchor) - headerTokens;
      if (bodyBudget < MIN_SUMMARY_TOKENS) continue;

      const summaryTokens = Math.min(MAX_SUMMARY_TOKENS, bodyBudget);
      const plan: SummaryPlan = { system, overflow, kept, summaryTokens };
      // Probe with a full-size body so a rounding gap cannot promise a fit we do not have.
      const probe = this.assemble(plan, "x".repeat(summaryTokens * 4));
      if (this.estimateMessages(probe) <= budget) return plan;
    }

    return null;
  }

  private assemble(plan: SummaryPlan, summary: string): AiChatMessage[] {
    const summaryMessage: AiChatMessage = {
      role: "system",
      content: `${SUMMARY_HEADER}\n${summary}`,
    };
    const head = plan.system ? [plan.system, summaryMessage] : [summaryMessage];
    return [...head, ...plan.kept];
  }

  /**
   * Summarizes the overflow, splitting it into several calls only when
   * one request would itself exceed the context window. The calls still
   * produce a single summary string.
   */
  private async summarize(
    overflow: AiChatMessage[],
    window: ContextWindow,
    summaryTokens: number,
  ): Promise<string> {
    const instruction: AiChatMessage = { role: "system", content: SUMMARY_SYSTEM_PROMPT };
    const room = window.contextLength - summaryTokens - this.estimateMessages([instruction]);
    if (room < MIN_SUMMARY_TOKENS) {
      throw new Error("Context window is too small to summarize.");
    }

    let running = "";
    let index = 0;
    while (index < overflow.length) {
      const preface = running
        ? `Summary so far:\n${this.trimToTokens(running, summaryTokens)}\n\nContinue the summary with these later messages:\n`
        : "";
      if (preface && this.estimateMessages([{ role: "user", content: preface }]) > room) {
        throw new Error("Context window is too small to summarize.");
      }

      const lines: string[] = [];
      while (index < overflow.length) {
        const message = overflow[index];
        if (!message) break;
        const line = `${message.role}: ${message.content}`;
        const candidate = preface + (lines.length > 0 ? `${lines.join("\n\n")}\n\n` : "") + line;
        const fits = this.estimateMessages([{ role: "user", content: candidate }]) <= room;
        if (!fits && lines.length > 0) break;
        if (!fits) {
          const truncated = this.truncateLine(preface, line, room);
          index += 1;
          if (truncated) lines.push(truncated);
          break;
        }
        lines.push(line);
        index += 1;
      }

      if (lines.length === 0) {
        if (running) {
          log.warn("stopped summarizing; later overflow did not fit in one request");
          break;
        }
        throw new Error("Nothing to summarize.");
      }

      const userContent = preface + lines.join("\n\n");

      running = (
        await this.options.provider.generate({
          model: this.options.getModel(),
          messages: [instruction, { role: "user", content: userContent }],
          options: { temperature: SUMMARY_TEMPERATURE, maxTokens: summaryTokens },
        })
      ).trim();
      if (!running) throw new Error("Summary was empty.");
    }

    return running;
  }

  /** Truncates one oversized turn so the summary request still fits. */
  private truncateLine(preface: string, line: string, room: number): string {
    const overhead = this.estimateMessages([{ role: "user", content: "" }]);
    const contentBudget = room - overhead;
    if (contentBudget <= 0) return "";
    const combined = preface + line;
    if (this.estimateTokens(combined) <= contentBudget) return line;
    const keep = Math.max(0, contentBudget * 4 - preface.length);
    return line.slice(0, keep);
  }

  private trimToTokens(text: string, tokens: number): string {
    const trimmed = text.trim();
    if (tokens <= 0 || !trimmed) return "";
    if (this.estimateTokens(trimmed) <= tokens) return trimmed;
    let chars = Math.max(0, tokens * 4);
    while (chars > 0 && this.estimateTokens(trimmed.slice(0, chars)) > tokens) {
      chars = Math.floor(chars * 0.9);
    }
    return trimmed.slice(0, chars).trim();
  }
}
