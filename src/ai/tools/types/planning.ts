import type { PermissionRequest } from "./permission";
import type { ToolParameters, ValidationResult } from "./tool";

/**
 * # Planning + routing types
 *
 * An `ExecutionPlan` is the ordered set of tool steps a request
 * decomposes into. The `ToolRouter` resolves each step against the
 * registry, validates it, and attaches permission requests, yielding
 * an `ExecutionRequest` — the terminal artifact of this milestone.
 * Nothing here executes.
 */

/** How a step parameter is supplied by an upstream step's output. */
export interface ParameterBinding {
  parameter: string;
  fromStepId: string;
}

export interface PlanStep {
  id: string;
  toolName: string;
  parameters: ToolParameters;
  /** Step ids that must complete first. */
  dependsOn: string[];
  /** Parameters filled from an upstream step's result at execution time. */
  bindings: ParameterBinding[];
}

export interface ExecutionPlan {
  id: string;
  request: string;
  steps: PlanStep[];
  reasoning: string;
}

/** A plan step after the router resolved its tool and checked it. */
export interface RoutedStep {
  step: PlanStep;
  toolName: string;
  validation: ValidationResult;
  /** Null when the tool needs no permissions (e.g. a pure calculator). */
  permissionRequest: PermissionRequest | null;
}

export type ExecutionRequestOutcome = "ready" | "invalid" | "no-tools";

/**
 * The bottom of the architecture diagram. A fully planned, routed, and
 * permission-annotated request that a FUTURE executor will consume.
 * Producing one never runs anything.
 */
export interface ExecutionRequest {
  id: string;
  createdAt: number;
  message: string;
  requiresTools: boolean;
  plan: ExecutionPlan | null;
  routedSteps: RoutedStep[];
  permissionRequests: PermissionRequest[];
  outcome: ExecutionRequestOutcome;
}
