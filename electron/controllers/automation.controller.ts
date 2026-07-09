import type { ActivityType } from "../../shared/activity";
import {
  AutomationError,
  type AutomationResult,
} from "../../shared/automation";
import { createLogger } from "../../shared/logger";
import { activityService } from "../activity/activity.service";

/**
 * # Automation controller (main process)
 *
 * Wraps every OS operation in an `AutomationResult` envelope and logs
 * tool, timing, and outcome. IPC handlers call these methods; the OS
 * work itself lives in `electron/automation/*`.
 */

const log = createLogger("main:automation");

/**
 * The subset of automation operations worth surfacing on the Activity
 * timeline, mapped to their activity type + a human description. Anything
 * absent here (list, notify, notes, …) is not recorded as an activity.
 */
const ACTIVITY_MAP: Record<string, { type: ActivityType; description: string }> = {
  "app-launch": { type: "application-opened", description: "Opened an application" },
  "clipboard-read": { type: "clipboard-access", description: "Read from the clipboard" },
  "clipboard-write": { type: "clipboard-access", description: "Wrote to the clipboard" },
  "reminder-create": { type: "reminder-created", description: "Created a reminder" },
  "file-search": { type: "tool-executed", description: "Searched for files" },
  "file-open": { type: "tool-executed", description: "Opened a file" },
};

export async function runAutomation<T>(
  operation: string,
  fn: () => T | Promise<T>,
): Promise<AutomationResult<T>> {
  const startedAt = Date.now();
  try {
    const data = await fn();
    log.info("automation ok", { operation, ms: Date.now() - startedAt });
    recordActivity(operation, "success");
    return { ok: true, data };
  } catch (error) {
    const code = error instanceof AutomationError ? error.code : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    log.warn("automation failed", { operation, code, message, ms: Date.now() - startedAt });
    recordActivity(operation, "failed");
    return { ok: false, code, message };
  }
}

function recordActivity(operation: string, status: "success" | "failed"): void {
  const entry = ACTIVITY_MAP[operation];
  if (entry) {
    activityService.logActivity({ type: entry.type, description: entry.description, status });
  }
}
