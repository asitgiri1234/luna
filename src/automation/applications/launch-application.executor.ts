import { type ToolParameters, type ToolResult, toolFailed, toolSuccess } from "@/ai/tools/types";
import { AutomationError } from "@shared/automation";

import type { ExecutorContext, ToolExecutor } from "../executor/types";
import { osBridge, unwrap } from "../os-bridge";

/**
 * # Launch application executor
 *
 * Opens a desktop application by name via the main process. Handles the
 * three required cases through the OS layer's classified errors:
 * unknown app, not installed, and already running (which focuses it).
 */
export class LaunchApplicationExecutor implements ToolExecutor {
  readonly name = "launch_application";

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const application = String(params.application ?? "").trim();
    if (!application) return toolFailed(this.name, "No application specified.");

    try {
      const result = unwrap(await osBridge().launchApp(application));
      const summary = result.alreadyRunning
        ? `${result.app} is already running${result.focused ? " — brought to front" : ""}.`
        : `${result.app} opened.`;
      return toolSuccess(this.name, { ...result, summary });
    } catch (error) {
      if (error instanceof AutomationError) {
        const message =
          error.code === "app-unknown"
            ? `Luna doesn't know how to open "${application}".`
            : error.message;
        return toolFailed(this.name, message);
      }
      return toolFailed(this.name, String(error));
    }
  }
}
