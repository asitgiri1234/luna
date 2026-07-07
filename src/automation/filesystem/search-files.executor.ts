import { type ToolParameters, type ToolResult, toolFailed, toolSuccess } from "@/ai/tools/types";

import type { ExecutorContext, ToolExecutor } from "../executor/types";
import { osBridge, unwrap } from "../os-bridge";

/**
 * # Search files executor
 *
 * Runs a ranked filename search across the user's common folders. The
 * top hit's path is returned as `reference`, so a following "open" or
 * "document" step in the plan can consume it (search → open).
 */
export class SearchFilesExecutor implements ToolExecutor {
  readonly name = "search_files";

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const query = String(params.query ?? "").trim();
    if (!query) return toolFailed(this.name, "No search query provided.");
    const fileType = params.fileType ? String(params.fileType) : undefined;

    try {
      const hits = unwrap(await osBridge().searchFiles({ query, fileType }));
      if (hits.length === 0) {
        return toolSuccess(this.name, { hits, summary: `No files found for “${query}”.` });
      }
      return toolSuccess(this.name, {
        hits,
        reference: hits[0].path,
        summary: `Found ${hits.length} file${hits.length === 1 ? "" : "s"} for “${query}”.`,
      });
    } catch (error) {
      return toolFailed(this.name, error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * # Document executor
 *
 * Opens a document by path (or the `reference` bound from a preceding
 * search step). Completes the "find my resume and open it" plan.
 */
export class DocumentExecutor implements ToolExecutor {
  readonly name = "document";

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const path = String(params.path ?? "").trim();
    if (!path) return toolFailed(this.name, "No document path provided.");
    try {
      unwrap(await osBridge().openFile(path));
      const name = path.split(/[\\/]/).pop() ?? path;
      return toolSuccess(this.name, { path, summary: `Opened ${name}.` });
    } catch (error) {
      return toolFailed(this.name, error instanceof Error ? error.message : String(error));
    }
  }
}
