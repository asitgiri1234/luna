import type { Permission, ToolParameters } from "./tool";

/**
 * # Permission request
 *
 * Produced by the permission layer before any tool could run. It is the
 * hand-off point to a future approval UI + executor: nothing executes
 * until a `PermissionRequest` is explicitly granted.
 */
export interface PermissionRequest {
  id: string;
  toolName: string;
  permissions: Permission[];
  parameters: ToolParameters;
  reason: string;
  createdAt: number;
}
