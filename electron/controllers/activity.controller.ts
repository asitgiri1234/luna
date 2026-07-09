import type { ActivityQuery, ActivityRecord, DbResult } from "../../shared/activity";
import { PersistenceError } from "../../shared/conversations";
import { createLogger } from "../../shared/logger";
import { ActivityService, activityService } from "../activity/activity.service";

/**
 * # Activity controller (main process)
 *
 * Turns `activity:*` IPC calls into `ActivityService` calls, wrapping
 * every result in a `DbResult` so failures never throw across the wire.
 * Logging itself happens inside the other controllers — this surface is
 * read/clear only.
 */

const log = createLogger("main:activity:controller");

function run<T>(operation: string, fn: () => T): DbResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    const code = error instanceof PersistenceError ? error.code : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    log.warn("activity operation failed", { operation, code, message });
    return { ok: false, code, message };
  }
}

export class ActivityController {
  constructor(private readonly service: ActivityService = activityService) {}

  list(query: ActivityQuery = {}): DbResult<ActivityRecord[]> {
    return run("list", () => this.service.queryActivities(query));
  }

  clear(): DbResult<null> {
    return run("clear", () => {
      this.service.clearActivities();
      return null;
    });
  }
}
