import type { IntentDetector } from "@/ai/tools/intent/intent-detector";
import type { Planner } from "@/ai/tools/planner/planner";
import type { ToolRegistry } from "@/ai/tools/registry/tool-registry";
import type { ToolRouter } from "@/ai/tools/router/tool-router";
import type {
  ExecutionRequest,
  Tool,
  ToolExecutionContext,
} from "@/ai/tools/types";
import type { Logger } from "@shared/logger";

/** A tool as described to callers/UI (no methods, safe to serialize). */
export interface ToolDescriptor {
  name: string;
  description: string;
  category: string;
  parameters: Tool["parameters"];
  permissionsRequired: Tool["permissionsRequired"];
}

/**
 * # Tool planning service
 *
 * The façade over the whole framework and its single public entry
 * point. Runs the pipeline end-to-end:
 *
 *   message → IntentDetector → Planner → ToolRouter → ExecutionRequest
 *
 * and logs every decision (intent, chosen tools, confidence, plan). It
 * stops at the `ExecutionRequest`; it never executes a tool. A future
 * milestone consumes the request (approval UI + executor).
 */
export class ToolPlanningService {
  constructor(
    private readonly detector: IntentDetector,
    private readonly planner: Planner,
    private readonly router: ToolRouter,
    private readonly registry: ToolRegistry,
    private readonly logger: Logger,
    private readonly context: ToolExecutionContext,
  ) {}

  /** Plans (but never executes) tool use for a natural-language message. */
  async plan(message: string): Promise<ExecutionRequest> {
    this.logger.info("planning request", { message: message.slice(0, 120) });

    const intent = await this.detector.detect(message);
    if (!intent.requiresTools) {
      this.logger.info("no tools required", { confidence: intent.confidence });
      return this.router.route(message, null, this.context);
    }

    this.logger.info("intent resolved", {
      confidence: intent.confidence,
      tools: intent.intents.map((i) => i.toolName),
    });

    const plan = this.planner.plan(message, intent);
    const request = this.router.route(message, plan, this.context);

    this.logger.info("execution request ready", {
      outcome: request.outcome,
      steps: request.routedSteps.length,
      permissionsNeeded: request.permissionRequests.length,
    });
    return request;
  }

  /** The current tool catalog, for UI or diagnostics. */
  listTools(): ToolDescriptor[] {
    return this.registry.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      permissionsRequired: tool.permissionsRequired,
    }));
  }
}
