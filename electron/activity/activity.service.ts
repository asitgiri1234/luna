import type {
  ActivityRecord,
  ActivityQuery,
  ActivityType,
  LogActivityInput,
} from "../../shared/activity";
import { createLogger } from "../../shared/logger";
import { ActivityRepository } from "./activity.repository";

/**
 * # ActivityService (main process)
 *
 * The Activity History's brain. Records important user and assistant
 * actions into the append-only log and reads them back for the timeline
 * (list / filter by type / search by description / clear).
 *
 * `logActivity` is deliberately best-effort: it is called from inside
 * other controllers' happy paths, so a logging failure must never bubble
 * up and break the operation being logged. Every write is swallowed and
 * merely warned about.
 */

const log = createLogger("main:activity");

export class ActivityService {
  constructor(private readonly repository: ActivityRepository = new ActivityRepository()) {}

  /** Records one action. Never throws — logging must not break the caller. */
  logActivity(input: LogActivityInput): void {
    try {
      this.repository.insert({
        id: crypto.randomUUID(),
        type: input.type,
        description: input.description,
        status: input.status ?? "success",
        timestamp: Date.now(),
        metadata: input.metadata ?? null,
      });
    } catch (error) {
      log.warn("could not record activity", {
        type: input.type,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** All recorded activities, newest first. */
  listActivities(): ActivityRecord[] {
    return this.repository.list();
  }

  /** Activities of a single type, newest first. */
  filterActivities(type: ActivityType): ActivityRecord[] {
    return this.repository.list({ type });
  }

  /** Activities whose description matches the query, newest first. */
  searchActivities(query: string): ActivityRecord[] {
    return this.repository.list({ search: query });
  }

  /** General listing used by the timeline (type filter + search combined). */
  queryActivities(query: ActivityQuery): ActivityRecord[] {
    return this.repository.list(query);
  }

  /** Erases the entire history. */
  clearActivities(): void {
    this.repository.clear();
  }
}

/**
 * Shared instance. Activities are logged from several controllers, so
 * they all record through one stateless service (the repository resolves
 * `getDb()` lazily per call, so this is safe to construct at import time).
 */
export const activityService = new ActivityService();
