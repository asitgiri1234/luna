import type {
  PermissionRequest,
  Tool,
  ToolParameters,
} from "@/ai/tools/types";

/**
 * # Permission layer
 *
 * The gate between a routed plan step and any execution. For every tool
 * that needs permissions it produces a `PermissionRequest`; a future
 * approval UI + executor turns a granted request into an actual run.
 *
 * Invariant for this milestone (and the privacy-first product goal):
 * nothing executes automatically. A tool with no required permissions
 * (e.g. the calculator) yields no request, but is still not executed
 * here.
 *
 * ## Extension point
 * User-defined policies ("always allow the calculator", "never allow
 * file writes") slot into `requiresApproval`.
 */
export class PermissionLayer {
  /** Whether a tool must be approved before running. */
  requiresApproval(tool: Tool): boolean {
    return tool.permissionsRequired.length > 0;
  }

  /** Builds a permission request, or null if the tool needs none. */
  createRequest(tool: Tool, parameters: ToolParameters, reason: string): PermissionRequest | null {
    if (!this.requiresApproval(tool)) return null;
    return {
      id: crypto.randomUUID(),
      toolName: tool.name,
      permissions: [...tool.permissionsRequired],
      parameters,
      reason,
      createdAt: Date.now(),
    };
  }
}
