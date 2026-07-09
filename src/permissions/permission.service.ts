import { PersistenceError } from "@shared/conversations";
import type {
  DbResult,
  PermissionId,
  PermissionRecord,
  PermissionStatus,
} from "@shared/permissions";
import type { LunaPermissionsApi } from "@/types/electron";

/**
 * # Permission service (renderer)
 *
 * The only module that talks to the permissions IPC bridge. Unwraps
 * `DbResult` envelopes into values or thrown `PersistenceError`s so the
 * store can use ordinary try/catch. Components never touch `window.luna`.
 */

function bridge(): LunaPermissionsApi {
  const api = window.luna?.permissions;
  if (!api) {
    throw new PersistenceError(
      "unknown",
      "The permissions bridge is unavailable. Launch Luna through Electron.",
    );
  }
  return api;
}

function unwrap<T>(result: DbResult<T>): T {
  if (result.ok) return result.data;
  throw new PersistenceError(result.code, result.message);
}

export const permissionService = {
  async list(): Promise<PermissionRecord[]> {
    return unwrap(await bridge().list());
  },

  async grant(id: PermissionId): Promise<PermissionRecord> {
    return unwrap(await bridge().grant(id));
  },

  async revoke(id: PermissionId): Promise<PermissionRecord> {
    return unwrap(await bridge().revoke(id));
  },

  async status(id: PermissionId): Promise<PermissionStatus> {
    return unwrap(await bridge().status(id));
  },
};
