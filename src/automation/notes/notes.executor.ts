import { type ToolParameters, type ToolResult, toolFailed, toolSuccess } from "@/ai/tools/types";

import type { ExecutorContext, ToolExecutor } from "../executor/types";
import { osBridge, unwrap } from "../os-bridge";

/**
 * # Notes executor
 *
 * Creates a note (stored locally as a Markdown file with metadata in
 * SQLite). "Edit" and "open" are supported by the OS layer and reachable
 * here; the planner currently produces create requests.
 */
export class NotesExecutor implements ToolExecutor {
  readonly name = "notes";

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const content = String(params.content ?? "").trim();
    if (!content) return toolFailed(this.name, "The note has no content.");
    const title = String(params.title ?? "").trim() || deriveTitle(content);

    try {
      const note = unwrap(await osBridge().createNote({ title, content }));
      return toolSuccess(this.name, { note, summary: `Saved note “${note.title}”.` });
    } catch (error) {
      return toolFailed(this.name, error instanceof Error ? error.message : String(error));
    }
  }
}

/** First few words of the content, as a fallback title. */
function deriveTitle(content: string): string {
  return content.split(/\s+/).slice(0, 6).join(" ").slice(0, 50) || "Untitled note";
}
