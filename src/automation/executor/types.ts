import type { PermissionRequest, ToolParameters, ToolResult } from "@/ai/tools/types";

/**
 * # Execution types (renderer)
 *
 * Types for the automation layer that turns a planned `ExecutionRequest`
 * (from the Milestone 6 Tool Router) into real, permission-gated action.
 */

export interface ExecutorContext {
  platform: string;
}

/**
 * A tool executor performs one tool's real work. Executors are the
 * `src/automation/<category>/` implementations; they run only after the
 * permission gate approves.
 *
 * `execute` may return a `reference` in its result data — a value later
 * steps can consume through a plan binding (e.g. search → open).
 */
export interface ToolExecutor {
  readonly name: string;
  execute(params: ToolParameters, context: ExecutorContext): Promise<ToolResult>;
}

// -- Permission decisions ----------------------------------------------------

export type PermissionState = "pending" | "approved" | "denied" | "cancelled";

export interface PermissionDecision {
  state: PermissionState;
  /** Persist this choice for future requests of the same tool. */
  remember: boolean;
}

// -- Execution cards (UI) ----------------------------------------------------

export type ExecutionStatus =
  | "planned"
  | "awaiting-permission"
  | "running"
  | "success"
  | "failed"
  | "denied"
  | "cancelled";

/** One visible row of the automation UI, mirrored from an execution step. */
export interface ExecutionCard {
  id: string;
  toolName: string;
  title: string;
  status: ExecutionStatus;
  detail?: string;
  startedAt: number;
  finishedAt?: number;
}

/** A permission prompt awaiting the user's decision. */
export interface PendingPermission {
  id: string;
  request: PermissionRequest;
}
