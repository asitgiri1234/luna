import type { ToolRegistry } from "@/ai/tools/registry/tool-registry";
import type {
  ExecutionPlan,
  IntentDetectionResult,
  ParameterBinding,
  PlanStep,
} from "@/ai/tools/types";
import type { Logger } from "@shared/logger";

/**
 * # Planner
 *
 * Turns detected intents into an ordered `ExecutionPlan`. Deterministic
 * by design (the LLM already did the interpreting in the detector), so
 * plans are predictable and testable.
 *
 * Multi-tool requests are chained by data flow: when a step's tool
 * `accepts` a data kind that an earlier step's tool `produces`, the
 * planner records a dependency and a parameter binding. That is how
 * "find my resume and open it" becomes search_files → document, with
 * the document's `path` bound to the search result.
 *
 * ## Extension point
 * Richer data-flow (branching, fan-out, LLM-proposed bindings) slots in
 * here without changing the router or the tools.
 */
export class Planner {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly logger: Logger,
  ) {}

  plan(message: string, intent: IntentDetectionResult): ExecutionPlan | null {
    if (!intent.requiresTools || intent.intents.length === 0) return null;

    const steps: PlanStep[] = intent.intents.map((detected, index) => ({
      id: `step-${index}`,
      toolName: detected.toolName,
      parameters: { ...detected.parameters },
      dependsOn: [],
      bindings: [],
    }));

    // Link each step to the nearest preceding step whose output it can
    // consume (producer → consumer data flow).
    for (let i = 0; i < steps.length; i += 1) {
      const tool = this.registry.get(steps[i].toolName);
      const accepts = tool?.dataFlow.accepts;
      const referenceParameter = tool?.dataFlow.referenceParameter;
      if (!accepts || !referenceParameter) continue;

      for (let j = i - 1; j >= 0; j -= 1) {
        const upstream = this.registry.get(steps[j].toolName);
        const produces = upstream?.dataFlow.produces;
        if (produces && accepts.includes(produces)) {
          steps[i].dependsOn.push(steps[j].id);
          const binding: ParameterBinding = {
            parameter: referenceParameter,
            fromStepId: steps[j].id,
          };
          steps[i].bindings.push(binding);
          break;
        }
      }
    }

    const plan: ExecutionPlan = {
      id: crypto.randomUUID(),
      request: message,
      steps,
      reasoning: intent.reasoning,
    };
    this.logger.debug("execution plan built", {
      steps: steps.map((s) => ({ tool: s.toolName, dependsOn: s.dependsOn })),
    });
    return plan;
  }
}
