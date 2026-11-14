import { BrowserWindow } from "electron";

import { createLogger } from "../../shared/logger";
import {
  PERMISSION_CHANNELS,
  type PermissionId,
  type PermissionUsedEvent,
  permissionDeniedMessage,
} from "../../shared/permissions";
import { PermissionService } from "./permission.service";

const log = createLogger("main:permissions:gate");

/**
 * # Permission gate (main process)
 *
 * The Privacy toggles are enforced here, at the main-process boundary,
 * so a renderer cannot skip them. `assertPermission` throws before any
 * work; `recordPermissionUse` stamps last-used and tells open windows.
 */

const service = new PermissionService();

export class PermissionDenied extends Error {
  constructor(public readonly permissionId: PermissionId) {
    super(permissionDeniedMessage(permissionId));
    this.name = "PermissionDenied";
  }
}

export function isPermissionAllowed(id: PermissionId): boolean {
  try {
    return service.getPermissionStatus(id) === "allowed";
  } catch (error) {
    // A broken permission store must not take the rest of the app down.
    log.warn("permission check failed", { id, error: String(error) });
    return true;
  }
}

/** Throws `PermissionDenied` when the Privacy toggle is off. */
export function assertPermission(id: PermissionId): void {
  if (!isPermissionAllowed(id)) throw new PermissionDenied(id);
}

/** Records a successful (or started) use and refreshes the Privacy page. */
export function recordPermissionUse(id: PermissionId): void {
  try {
    const lastUsed = service.recordUsage(id);
    if (lastUsed == null) return;
    const event: PermissionUsedEvent = { id, lastUsed };
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(PERMISSION_CHANNELS.used, event);
    }
  } catch (error) {
    log.warn("could not record permission use", { id, error: String(error) });
  }
}
