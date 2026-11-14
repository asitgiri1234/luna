import type { ToolResult } from "@/ai/tools/types";

/**
 * Turns finished tool results into the system-prompt block the model
 * reads before it replies. The actions have already run (or been
 * refused); the block tells the model to narrate that outcome and not
 * to invent a different one.
 */
export function formatToolOutcomes(results: ToolResult[]): string {
  if (results.length === 0) return "";

  const lines = results.map((result) => {
    const summary = readSummary(result.data);
    if (result.status === "success") {
      return `- ${result.toolName}: succeeded.${summary ? ` ${summary}` : ""}`;
    }
    if (result.status === "failed") {
      return `- ${result.toolName}: failed. ${result.error ?? "Unknown error."}`;
    }
    return `- ${result.toolName}: did not run. ${result.error ?? "It was cancelled or denied."}`;
  });

  return [
    "## Actions already taken this turn",
    "You already tried the actions below, before writing this reply. Tell the user what happened in plain language.",
    "If an action succeeded, confirm it using the summary. If it failed, was denied, or did not run, say so and do not pretend it worked. Do not claim any action that is not listed.",
    ...lines,
  ].join("\n");
}

/** True when this turn already stored a memory, so passive extraction should not propose it again. */
export function didSaveMemory(results: ToolResult[]): boolean {
  return results.some((result) => {
    if (result.toolName !== "memory" || result.status !== "success") return false;
    const data = result.data;
    return typeof data === "object" && data !== null && (data as { saved?: unknown }).saved === true;
  });
}

function readSummary(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const summary = (data as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary.trim() : "";
}
