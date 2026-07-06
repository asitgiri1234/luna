import type { ToolParameters } from "./tool";

/**
 * # Intent detection types
 *
 * The `IntentDetector` reads a natural-language message and returns
 * which tool(s), if any, it implies — with extracted parameters,
 * confidence, and reasoning. It decides nothing about permissions or
 * execution; it only interprets.
 */

/** One tool the message appears to call for. */
export interface DetectedIntent {
  toolName: string;
  parameters: ToolParameters;
  confidence: number;
  reasoning: string;
}

export interface IntentDetectionResult {
  /** False for ordinary chat that needs no tools. */
  requiresTools: boolean;
  /** Ordered as the request implies (earlier tools may feed later ones). */
  intents: DetectedIntent[];
  /** Overall confidence that tools are warranted at all. */
  confidence: number;
  reasoning: string;
}
