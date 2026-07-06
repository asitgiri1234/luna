import path from "node:path";

import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";

import { PersistenceError } from "../../../shared/conversations";
import { createLogger } from "../../../shared/logger";
import * as schema from "./schema";

/**
 * # Database client (main process)
 *
 * Owns the SQLite connection lifecycle:
 * - opens `luna.db` in Electron's per-user data directory
 * - enables WAL journaling and foreign-key enforcement
 * - applies pending Drizzle migrations at startup
 *
 * Failure is a state, not a crash: if opening or migrating fails, the
 * app keeps running chat-only and every repository call surfaces a
 * classified `PersistenceError` instead.
 */

export type Db = BetterSQLite3Database<typeof schema>;

const log = createLogger("main:db");

let db: Db | null = null;
let failure: PersistenceError | null = null;

function migrationsFolder(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "drizzle")
    : path.join(process.env.APP_ROOT ?? process.cwd(), "drizzle");
}

/** Opens the database and applies migrations. Call once at startup. */
export function initDatabase(): void {
  const file = path.join(app.getPath("userData"), "luna.db");
  let sqlite: Database.Database;

  try {
    sqlite = new Database(file);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  } catch (error) {
    failure = new PersistenceError(
      "db-unavailable",
      `Could not open the local database: ${error instanceof Error ? error.message : String(error)}`,
    );
    log.error("database unavailable", { file, message: failure.message });
    return;
  }

  const candidate = drizzle(sqlite, { schema });
  try {
    migrate(candidate, { migrationsFolder: migrationsFolder() });
  } catch (error) {
    failure = new PersistenceError(
      "migration-failed",
      `Database migration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    log.error("migration failed", { message: failure.message });
    sqlite.close();
    return;
  }

  db = candidate;
  log.info("database ready", { file });
}

/** Returns the live database or throws the classified startup failure. */
export function getDb(): Db {
  if (db) return db;
  throw failure ?? new PersistenceError("db-unavailable", "Database was never initialized.");
}
