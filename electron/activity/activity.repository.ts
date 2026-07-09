import { and, desc, eq, like } from "drizzle-orm";

import type {
  ActivityQuery,
  ActivityRecord,
  ActivityStatus,
  ActivityType,
} from "../../shared/activity";
import { createLogger } from "../../shared/logger";
import { getDb } from "../backend/db/client";
import { activities } from "../backend/db/schema";

/**
 * # Activity repository (main process)
 *
 * The only module that touches the `activities` table. Append-only audit
 * log: insert one row per action, list newest-first, optionally narrowed
 * by type and/or a description substring. `metadata` is stored as raw
 * JSON text and parsed defensively so one corrupt row can never poison a
 * whole listing.
 */

const log = createLogger("main:activity:repo");

/** Newest-first listings are capped so the timeline stays bounded. */
const LIST_LIMIT = 500;

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toRecord(row: typeof activities.$inferSelect): ActivityRecord {
  return {
    id: row.id,
    type: row.type as ActivityType,
    description: row.description,
    status: row.status as ActivityStatus,
    timestamp: row.timestamp,
    metadata: parseMetadata(row.metadata),
  };
}

export class ActivityRepository {
  insert(record: ActivityRecord): void {
    getDb()
      .insert(activities)
      .values({
        id: record.id,
        type: record.type,
        description: record.description,
        status: record.status,
        timestamp: record.timestamp,
        metadata: record.metadata ? safeStringify(record.metadata) : null,
      })
      .run();
  }

  /** Newest-first, optionally filtered by type and/or description substring. */
  list(query: ActivityQuery = {}): ActivityRecord[] {
    const filters = [];
    if (query.type && query.type !== "all") filters.push(eq(activities.type, query.type));
    const search = query.search?.trim();
    if (search) filters.push(like(activities.description, `%${search}%`));

    return getDb()
      .select()
      .from(activities)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(activities.timestamp))
      .limit(LIST_LIMIT)
      .all()
      .map(toRecord);
  }

  clear(): void {
    getDb().delete(activities).run();
  }
}

function safeStringify(value: Record<string, unknown>): string | null {
  try {
    return JSON.stringify(value);
  } catch (error) {
    log.warn("could not serialize activity metadata", { message: String(error) });
    return null;
  }
}
