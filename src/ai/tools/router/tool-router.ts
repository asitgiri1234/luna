import type { PermissionLayer } from "@/ai/tools/permission/permission-layer";
import type { ToolRegistry } from "@/ai/tools/registry/tool-registry";
import type {
  ExecutionPlan,
  ExecutionRequest,
  ExecutionRequestOutcome,
  PermissionRequest,
  RoutedStep,
  ToolExecutionContext,
  ToolParameters,
  ValidationResult,
} from "@/ai/tools/types";
import type { Logger } from "@shared/logger";

/**
 * # Tool router
 *
 * Turns an `ExecutionPlan` into an `ExecutionRequest`: for each step it
 * resolves the tool from the registry, validates the parameters, and
 * asks the permission layer for a `PermissionRequest`. It NEVER calls
 * `execute()`.
 *
 * Parameters supplied by an upstream step (bindings) count as satisfied
 * for validation — their concrete value is filled at execution time by
 * a future executor.
 */
export class ToolRouter {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly permissions: PermissionLayer,
    private readonly logger: Logger,
  ) {}

  route(
    message: string,
    plan: ExecutionPlan | null,
    context: ToolExecutionContext,
  ): ExecutionRequest {
    const base = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      message,
    };

    if (!plan || plan.steps.length === 0) {
      return {
        ...base,
        requiresTools: false,
        plan: null,
        routedSteps: [],
        permissionRequests: [],
        outcome: "no-tools",
      };
    }

    const routedSteps: RoutedStep[] = [];
    const permissionRequests: PermissionRequest[] = [];
    let anyInvalid = false;

    for (const step of plan.steps) {
      const tool = this.registry.get(step.toolName);
      if (!tool) {
        anyInvalid = true;
        routedSteps.push({
          step,
          toolName: step.toolName,
          validation: { valid: false, errors: [`Unknown tool "${step.toolName}".`] },
          permissionRequest: null,
        });
        continue;
      }

      // Bound parameters are provided by upstream steps at run time;
      // treat them as present for validation now.
      const effectiveParams: ToolParameters = { ...step.parameters };
      for (const binding of step.bindings) {
        effectiveParams[binding.parameter] = `<from ${binding.fromStepId}>`;
      }

      const validation: ValidationResult = tool.validate(effectiveParams);
      if (!tool.canExecute(context)) {
        validation.valid = false;
        validation.errors.push(`"${tool.name}" is not available in this environment.`);
      }
      if (!validation.valid) anyInvalid = true;

      const reason = `Luna wants to use "${tool.name}" to ${tool.description}`;
      const permissionRequest = this.permissions.createRequest(tool, step.parameters, reason);
      if (permissionRequest) permissionRequests.push(permissionRequest);

      routedSteps.push({ step, toolName: tool.name, validation, permissionRequest });
    }

    const outcome: ExecutionRequestOutcome = anyInvalid ? "invalid" : "ready";
    this.logger.info("execution request routed", {
      outcome,
      tools: routedSteps.map((s) => s.toolName),
      permissionsNeeded: permissionRequests.length,
    });

    return {
      ...base,
      requiresTools: true,
      plan,
      routedSteps,
      permissionRequests,
      outcome,
    };
  }
}
