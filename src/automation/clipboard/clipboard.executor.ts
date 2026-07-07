import { type ToolParameters, type ToolResult, toolFailed, toolSuccess } from "@/ai/tools/types";

import type { ExecutorContext, ToolExecutor } from "../executor/types";
import { osBridge, unwrap } from "../os-bridge";

/**
 * # Clipboard executor
 *
 * Copy / write / read / clear the system clipboard. Reading is
 * privacy-sensitive: the ClipboardTool declares `read-clipboard`, so the
 * permission gate always prompts before a read reaches here.
 */
export class ClipboardExecutor implements ToolExecutor {
  readonly name = "clipboard";

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const action = String(params.action ?? "").trim().toLowerCase();
    const bridge = osBridge();

    try {
      switch (action) {
        case "read": {
          const { text } = unwrap(await bridge.clipboardRead());
          return toolSuccess(this.name, {
            text,
            summary: text ? "Read clipboard contents." : "Clipboard is empty.",
          });
        }
        case "copy":
        case "write": {
          const content = String(params.content ?? "");
          unwrap(await bridge.clipboardWrite(content));
          return toolSuccess(this.name, { summary: "Copied to clipboard." });
        }
        case "clear": {
          unwrap(await bridge.clipboardClear());
          return toolSuccess(this.name, { summary: "Cleared the clipboard." });
        }
        default:
          return toolFailed(this.name, `Unknown clipboard action "${action}".`);
      }
    } catch (error) {
      return toolFailed(this.name, error instanceof Error ? error.message : String(error));
    }
  }
}
