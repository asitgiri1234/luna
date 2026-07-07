import { AutomationError, type AutomationResult } from "@shared/automation";
import type { LunaAutomationApi } from "@/types/electron";

/**
 * # OS bridge (renderer)
 *
 * The single accessor for the main-process automation API. Executors go
 * through here, never `window.luna` directly, so a browser tab degrades
 * gracefully and the surface stays swappable/testable.
 *
 * `unwrap` converts an `AutomationResult` envelope into a value or a
 * thrown `AutomationError`, so executors can use ordinary try/catch.
 */
export function osBridge(): LunaAutomationApi {
  const bridge = window.luna?.automation;
  if (!bridge) {
    throw new AutomationError(
      "unknown",
      "The desktop automation bridge is unavailable. Launch Luna through Electron.",
    );
  }
  return bridge;
}

export function unwrap<T>(result: AutomationResult<T>): T {
  if (result.ok) return result.data;
  throw new AutomationError(result.code, result.message);
}
