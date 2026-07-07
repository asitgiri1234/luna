import { asc, eq, lte } from "drizzle-orm";

import {
  type CreateReminderInput,
  type ReminderRecord,
} from "../../shared/automation";
import { createLogger } from "../../shared/logger";
import { getDb } from "../backend/db/client";
import { reminders } from "../backend/db/schema";
import { notify } from "./system";

/**
 * # Reminders automation (main process)
 *
 * Reminders persist in SQLite and fire a desktop notification at their
 * time. Pending reminders are rescheduled on startup, so they survive
 * restarts. In-process `setTimeout` timers drive scheduling while the
 * app runs; overdue reminders fire immediately on load.
 */

const log = createLogger("main:automation:reminders");

/** Node caps setTimeout at ~24.8 days; re-arm beyond that. */
const MAX_TIMEOUT_MS = 2_147_483_647;

const timers = new Map<string, NodeJS.Timeout>();

function schedule(record: ReminderRecord): void {
  clearTimer(record.id);
  const delay = record.remindAt - Date.now();

  if (delay <= 0) {
    void fire(record);
    return;
  }
  if (delay > MAX_TIMEOUT_MS) {
    timers.set(record.id, setTimeout(() => schedule(record), MAX_TIMEOUT_MS));
    return;
  }
  timers.set(record.id, setTimeout(() => void fire(record), delay));
}

async function fire(record: ReminderRecord): Promise<void> {
  clearTimer(record.id);
  try {
    notify("Reminder", record.title);
  } catch (error) {
    // A failed notification must not crash scheduling.
    log.warn("reminder notification failed", { id: record.id, error: String(error) });
  }
  try {
    getDb().update(reminders).set({ notified: true }).where(eq(reminders.id, record.id)).run();
  } catch (error) {
    log.warn("marking reminder notified failed", { id: record.id, error: String(error) });
  }
}

function clearTimer(id: string): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

/** Reschedule all not-yet-notified reminders. Call once at startup. */
export function initReminders(): void {
  let pending: ReminderRecord[];
  try {
    pending = getDb().select().from(reminders).where(eq(reminders.notified, false)).all() as
      ReminderRecord[];
  } catch (error) {
    log.warn("could not load reminders", { error: String(error) });
    return;
  }
  for (const record of pending) schedule(record);
  log.info("reminders scheduled", { count: pending.length });
}

export function createReminder(input: CreateReminderInput): ReminderRecord {
  const record: ReminderRecord = {
    id: crypto.randomUUID(),
    title: input.title,
    remindAt: input.remindAt,
    createdAt: Date.now(),
    notified: false,
  };
  getDb().insert(reminders).values(record).run();
  schedule(record);
  log.info("reminder created", { id: record.id, remindAt: record.remindAt });
  return record;
}

export function listReminders(): ReminderRecord[] {
  return getDb().select().from(reminders).orderBy(asc(reminders.remindAt)).all() as
    ReminderRecord[];
}

export function deleteReminder(id: string): void {
  clearTimer(id);
  getDb().delete(reminders).where(eq(reminders.id, id)).run();
  log.info("reminder deleted", { id });
}

/** Remove already-fired reminders older than a day (light housekeeping). */
export function pruneReminders(): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  try {
    getDb().delete(reminders).where(lte(reminders.remindAt, cutoff)).run();
  } catch {
    // best-effort
  }
}
