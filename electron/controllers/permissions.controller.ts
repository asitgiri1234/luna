import { PersistenceError } from "../../shared/conversations";
import {
  type DbResult,
  type PermissionId,
  type PermissionRecord,
  type PermissionStatus,
} from "../../shared/permissions";
import { createLogger } from "../../shared/logger";
import { PermissionService } from "../permissions/permission.service";

/**
 * # Permissions controller (main process)
 *
 * Turns `permissions:*` IPC calls into `PermissionService` calls, wrapping
 * every result in a `DbResult` so failures never throw across the wire.
 */

const log = createLogger("main:permissions:controller");

function run<T>(operation: string, fn: () => T): DbResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    const code = error instanceof PersistenceError ? error.code : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    log.warn("permission operation failed", { operation, code, message });
    return { ok: false, code, message };
  }
}

export class PermissionsController {
  private readonly service = new PermissionService();

  list(): DbResult<PermissionRecord[]> {
    return run("list", () => this.service.listPermissions());
  }

  grant(id: PermissionId): DbResult<PermissionRecord> {
    return run("grant", () => this.service.grantPermission(id));
  }

  revoke(id: PermissionId): DbResult<PermissionRecord> {
    return run("revoke", () => this.service.revokePermission(id));
  }

  status(id: PermissionId): DbResult<PermissionStatus> {
    return run("status", () => this.service.getPermissionStatus(id));
  }
}
