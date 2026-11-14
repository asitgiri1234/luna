import type { ToolPlanningService } from "@/ai/tools";
import type { ExecutionRequest, ToolResult } from "@/ai/tools/types";
import type { Logger } from "@shared/logger";

import type { ExecutionEngine } from "./executor/execution-engine";
import { didSaveMemory, formatToolOutcomes } from "./tool-outcome";

/**
 * What the conversation manager needs from a tool turn: the prompt
 * block to inject, and whether a memory was already saved explicitly.
 */
export interface ToolTurnContext {
  prompt: string;
  skipMemoryMining: boolean;
}

/** Minimal surface the conversation manager needs to run tools before a reply. */
export interface ConversationAutomationPort {
  /**
   * Plans and executes tools for a user message before the assistant
   * replies. Returns null for ordinary chat (no command hint, or the
   * planner found nothing to run).
   */
  resolveForReply(text: string): Promise<ToolTurnContext | null>;
  /** Abandons an in-flight tool turn (Stop, or the thread changed). */
  cancelPending(): void;
}

/**
 * Cheap pre-filter: only spend an LLM intent-detection call when the
 * message plausibly asks for an action. Keeps ordinary chat fast and
 * avoids spurious permission prompts.
 */
const COMMAND_HINT =
  /\b(open|launch|start|run|search|find|remind|reminder|copy|paste|clipboard|calculate|compute|note|browse|google|go to|visit|website|remember|recall|memorize|memory)\b/i;

/**
 * # Automation service (renderer façade)
 *
 * The single entry point that turns a natural-language message into
 * executed, permission-gated actions:
 *
 *   message → ToolPlanningService (plan + route) → ExecutionEngine (execute)
 *
 * Chat calls `resolveForReply` before streaming, then injects the
 * formatted outcomes so the model can confirm, explain a failure, or
 * say an action was denied. `run` stays available for direct callers.
 * Nothing runs without the permission gate approving.
 */
export class AutomationService implements ConversationAutomationPort {
  /** Set when the user stops the turn while planning or executing. */
  private replyAborted = false;

  constructor(
    private readonly planning: ToolPlanningService,
    private readonly engine: ExecutionEngine,
    private readonly logger: Logger,
  ) {}

  /** Plans tools for a message and executes any that are approved. */
  async run(message: string): Promise<{ request: ExecutionRequest; results: ToolResult[] }> {
    this.replyAborted = false;
    const request = await this.planning.plan(message);
    if (this.replyAborted || !request.requiresTools) {
      this.logger.debug("no tools to execute", { message: message.slice(0, 80) });
      return { request, results: [] };
    }
    this.logger.info("executing plan", {
      steps: request.routedSteps.length,
      tools: request.routedSteps.map((s) => s.toolName),
    });
    const { results } = await this.engine.run(request, () => this.replyAborted);
    return { request, results };
  }

  async resolveForReply(text: string): Promise<ToolTurnContext | null> {
    if (!COMMAND_HINT.test(text)) return null;
    try {
      const { results } = await this.run(text);
      if (this.replyAborted || results.length === 0) return null;
      const prompt = formatToolOutcomes(results);
      if (!prompt) return null;
      return { prompt, skipMemoryMining: didSaveMemory(results) };
    } catch (error) {
      this.logger.warn("tool turn failed", { error: String(error) });
      return {
        prompt: formatToolOutcomes([
          {
            status: "failed",
            toolName: "automation",
            error: "The action could not be planned or run.",
          },
        ]),
        skipMemoryMining: false,
      };
    }
  }

  cancelPending(): void {
    this.replyAborted = true;
    this.engine.cancel();
  }
}
