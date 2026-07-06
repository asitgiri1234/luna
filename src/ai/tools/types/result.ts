import type { PermissionRequest } from "./permission";

/**
 * # Tool result
 *
 * The four terminal states of a tool invocation. This milestone only
 * ever produces `permission-required` (placeholders never execute); the
 * other states exist so the executing milestone plugs in without
 * changing this contract.
 */
export type ToolResultStatus = "success" | "failed" | "cancelled" | "permission-required";

export interface ToolResult {
  status: ToolResultStatus;
  toolName: string;
  data?: unknown;
  error?: string;
  /** Present when `status === "permission-required"`. */
  permissionRequest?: PermissionRequest;
}

export function toolSuccess(toolName: string, data?: unknown): ToolResult {
  return { status: "success", toolName, data };
}

export function toolFailed(toolName: string, error: string): ToolResult {
  return { status: "failed", toolName, error };
}

export function toolCancelled(toolName: string): ToolResult {
  return { status: "cancelled", toolName };
}

export function toolPermissionRequired(
  toolName: string,
  permissionRequest: PermissionRequest,
): ToolResult {
  return { status: "permission-required", toolName, permissionRequest };
}
