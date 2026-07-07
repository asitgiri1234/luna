import type { ToolPlanningService } from "@/ai/tools";
import type { ExecutionRequest, ToolResult } from "@/ai/tools/types";
import type { Logger } from "@shared/logger";

import type { ExecutionEngine } from "./executor/execution-engine";

/** Minimal surface the conversation manager needs to trigger automation. */
export interface ConversationAutomationPort {
  observeUserMessage(text: string): void;
}

/**
 * Cheap pre-filter: only spend an LLM intent-detection call when the
 * message plausibly asks for an action. Keeps ordinary chat fast and
 * avoids spurious permission prompts.
 */
const COMMAND_HINT =
  /\b(open|launch|start|run|search|find|remind|reminder|copy|paste|clipboard|calculate|compute|note|browse|google|go to|visit|website)\b/i;

/**
 * # Automation service (renderer façade)
 *
 * The single entry point that turns a natural-language message into
 * executed, permission-gated actions:
 *
 *   message → ToolPlanningService (plan + route) → ExecutionEngine (execute)
 *
 * It reuses the Milestone 6 planner/router unchanged — execution never
 * bypasses the Tool Router — and delegates all OS work to the engine's
 * executors. Nothing runs without the permission gate approving.
 */
export class AutomationService implements ConversationAutomationPort {
  constructor(
    private readonly planning: ToolPlanningService,
    private readonly engine: ExecutionEngine,
    private readonly logger: Logger,
  ) {}

  /** Plans tools for a message and executes any that are approved. */
  async run(message: string): Promise<{ request: ExecutionRequest; results: ToolResult[] }> {
    const request = await this.planning.plan(message);
    if (!request.requiresTools) {
      this.logger.debug("no tools to execute", { message: message.slice(0, 80) });
      return { request, results: [] };
    }
    this.logger.info("executing plan", {
      steps: request.routedSteps.length,
      tools: request.routedSteps.map((s) => s.toolName),
    });
    const { results } = await this.engine.run(request);
    return { request, results };
  }

  /**
   * Fire-and-forget trigger from the conversation flow. Applies the
   * command pre-filter, then plans + executes (permission-gated). Runs
   * after the assistant reply so it never competes with streaming.
   */
  observeUserMessage(text: string): void {
    if (!COMMAND_HINT.test(text)) return;
    void this.run(text).catch((error) => {
      this.logger.warn("automation run failed", { error: String(error) });
    });
  }
}
