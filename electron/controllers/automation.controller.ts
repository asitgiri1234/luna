import {
  AutomationError,
  type AutomationResult,
} from "../../shared/automation";
import { createLogger } from "../../shared/logger";

/**
 * # Automation controller (main process)
 *
 * Wraps every OS operation in an `AutomationResult` envelope and logs
 * tool, timing, and outcome. IPC handlers call these methods; the OS
 * work itself lives in `electron/automation/*`.
 */

const log = createLogger("main:automation");

export async function runAutomation<T>(
  operation: string,
  fn: () => T | Promise<T>,
): Promise<AutomationResult<T>> {
  const startedAt = Date.now();
  try {
    const data = await fn();
    log.info("automation ok", { operation, ms: Date.now() - startedAt });
    return { ok: true, data };
  } catch (error) {
    const code = error instanceof AutomationError ? error.code : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    log.warn("automation failed", { operation, code, message, ms: Date.now() - startedAt });
    return { ok: false, code, message };
  }
}
