import { type ToolParameters, type ToolResult, toolFailed, toolSuccess } from "@/ai/tools/types";

import type { ExecutorContext, ToolExecutor } from "../executor/types";
import { osBridge, unwrap } from "../os-bridge";
import { parseTime } from "./time-parser";

/**
 * # Reminder executor
 *
 * Creates a locally stored reminder that fires a desktop notification at
 * its time. The natural-language `time` parameter (e.g. "tomorrow 5 PM")
 * is resolved to a timestamp; unparseable or past times fail friendly.
 * List/delete are handled through the OS layer for a future reminders UI.
 */
export class ReminderExecutor implements ToolExecutor {
  readonly name = "reminder";

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const title = String(params.title ?? "").trim();
    const timeText = String(params.time ?? "").trim();
    if (!title) return toolFailed(this.name, "The reminder needs a title.");
    if (!timeText) return toolFailed(this.name, "The reminder needs a time.");

    const remindAt = parseTime(timeText);
    if (remindAt === null) {
      return toolFailed(this.name, `Couldn't understand the time “${timeText}”.`);
    }
    if (remindAt <= Date.now()) {
      return toolFailed(this.name, "That time is in the past.");
    }

    try {
      const reminder = unwrap(await osBridge().createReminder({ title, remindAt }));
      const when = new Date(remindAt).toLocaleString();
      return toolSuccess(this.name, { reminder, summary: `Reminder set for ${when}.` });
    } catch (error) {
      return toolFailed(this.name, error instanceof Error ? error.message : String(error));
    }
  }
}
