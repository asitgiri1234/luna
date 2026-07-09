import { eq } from "drizzle-orm";

import type { PermissionId, PermissionStatus } from "../../shared/permissions";
import { getDb } from "../backend/db/client";
import { permissions } from "../backend/db/schema";

/**
 * # Permission repository (main process)
 *
 * The only module that touches the `permissions` table. Persists just the
 * live state (status + last-used) per permission id; the descriptive
 * metadata lives in the shared catalog.
 */

export interface PermissionState {
  id: PermissionId;
  status: PermissionStatus;
  lastUsed: number | null;
  updatedAt: number;
}

function toState(row: typeof permissions.$inferSelect): PermissionState {
  return {
    id: row.id as PermissionId,
    status: row.status as PermissionStatus,
    lastUsed: row.lastUsed ?? null,
    updatedAt: row.updatedAt,
  };
}

export class PermissionRepository {
  list(): PermissionState[] {
    return getDb().select().from(permissions).all().map(toState);
  }

  get(id: PermissionId): PermissionState | undefined {
    const row = getDb().select().from(permissions).where(eq(permissions.id, id)).get();
    return row ? toState(row) : undefined;
  }

  /** Sets a permission's status (inserts the row on first use). */
  setStatus(id: PermissionId, status: PermissionStatus): void {
    getDb()
      .insert(permissions)
      .values({ id, status, lastUsed: null, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: permissions.id, set: { status, updatedAt: Date.now() } })
      .run();
  }

  /** Records that a capability was used just now (leaves status intact). */
  touch(id: PermissionId, lastUsed: number): void {
    getDb()
      .insert(permissions)
      .values({ id, status: "allowed", lastUsed, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: permissions.id, set: { lastUsed, updatedAt: Date.now() } })
      .run();
  }
}
