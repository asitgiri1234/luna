/**
 * # AI error layer (renderer)
 *
 * Centralized error handling for the AI core. The canonical `AiError`
 * class and code taxonomy live in `shared/ai.ts` (they cross the IPC
 * boundary); this module re-exports them and adds renderer-side
 * helpers so the rest of `src/` has a single import path for AI
 * failures.
 *
 * Codes: `provider-not-installed`, `provider-unavailable`,
 * `model-missing`, `timeout`, `cancelled`, `unknown`.
 *
 * UI copy for each code intentionally does NOT live here — presentation
 * belongs to components (see `ChatErrorBanner`).
 */

export { AiError, toAiError } from "@shared/ai";
export type { AiErrorCode } from "@shared/ai";

import { AiError } from "@shared/ai";

export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError;
}

/** True when the failure is the user's own stop action, not a fault. */
export function isCancellation(error: unknown): boolean {
  return isAiError(error) && error.code === "cancelled";
}
