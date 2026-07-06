/**
 * # Shared AI contract
 *
 * The single source of truth for everything that crosses the IPC
 * boundary between the renderer's AI core (`src/ai/`) and the main
 * process backend (`electron/backend/`). Both TypeScript projects
 * include this file — keep it free of imports from either side.
 *
 * Nothing in here is Ollama-specific: requests carry a `providerId`,
 * so new providers plug in without touching this contract.
 */

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant";

/** Wire format of a single conversation turn sent to a model. */
export interface AiChatMessage {
  role: ChatRole;
  content: string;
}

// ---------------------------------------------------------------------------
// Errors (centralized taxonomy — every AI failure maps to one of these)
// ---------------------------------------------------------------------------

export type AiErrorCode =
  /** The provider's runtime is not installed on this machine. */
  | "provider-not-installed"
  /** The provider exists but cannot be reached (not running, wrong port…). */
  | "provider-unavailable"
  /** The requested model is not available on the provider. */
  | "model-missing"
  /** The provider stopped responding mid-request. */
  | "timeout"
  /** The user (or the app) aborted the request. */
  | "cancelled"
  /** Anything we could not classify. */
  | "unknown";

/** Canonical AI error. Thrown in the main process, re-hydrated in the renderer. */
export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Normalizes any thrown value into an `AiError`. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new AiError("unknown", message);
}

// ---------------------------------------------------------------------------
// Generation requests / streaming events
// ---------------------------------------------------------------------------

/** Sampling and length parameters. All optional — providers apply defaults. */
export interface GenerationOptions {
  temperature?: number;
  topP?: number;
  /** Maximum number of tokens to generate for the response. */
  maxTokens?: number;
}

/** A renderer → main request to start one streaming generation. */
export interface AiStreamRequest {
  requestId: string;
  providerId: string;
  model: string;
  messages: AiChatMessage[];
  options?: GenerationOptions;
}

/** Events streamed main → renderer for one generation request. */
export type AiStreamEvent =
  | { requestId: string; type: "token"; token: string }
  | { requestId: string; type: "done"; cancelled: boolean }
  | { requestId: string; type: "error"; code: AiErrorCode; message: string };

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/** Result of probing a provider (used by future onboarding/status UI). */
export interface ProviderHealth {
  ok: boolean;
  /** Set when `ok` is false. */
  code?: AiErrorCode;
  message?: string;
  /** Model ids available on the provider, when it responded. */
  models?: string[];
}

// ---------------------------------------------------------------------------
// IPC channels
// ---------------------------------------------------------------------------

export const AI_CHANNELS = {
  start: "ai:start",
  cancel: "ai:cancel",
  event: "ai:event",
  health: "ai:health",
} as const;
