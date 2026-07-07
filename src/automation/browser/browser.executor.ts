import { type ToolParameters, type ToolResult, toolFailed, toolSuccess } from "@/ai/tools/types";

import type { ExecutorContext, ToolExecutor } from "../executor/types";
import { osBridge, unwrap } from "../os-bridge";

/**
 * # Browser executor
 *
 * Opens a URL, or runs a Google search for a query, in the default
 * browser. A bare query becomes a Google search URL; a URL missing its
 * scheme gets `https://`.
 */
export class BrowserExecutor implements ToolExecutor {
  readonly name = "browser";

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const rawUrl = params.url ? String(params.url).trim() : "";
    const query = params.query ? String(params.query).trim() : "";

    let target: string;
    let summary: string;
    if (rawUrl) {
      target = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      summary = `Opened ${target}`;
    } else if (query) {
      target = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      summary = `Searched Google for “${query}”.`;
    } else {
      return toolFailed(this.name, "Provide a URL or a search query.");
    }

    try {
      unwrap(await osBridge().openUrl(target));
      return toolSuccess(this.name, { url: target, summary });
    } catch (error) {
      return toolFailed(this.name, error instanceof Error ? error.message : String(error));
    }
  }
}
