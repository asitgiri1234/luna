import { ipcMain } from "electron";

import { PERMISSION_CHANNELS, type PermissionId } from "../../shared/permissions";
import type { PermissionsController } from "../controllers/permissions.controller";

/**
 * # Permissions IPC registration
 *
 * Binds the `permissions:*` invoke channels to the injected controller.
 * Every handler returns a `DbResult` and never throws across IPC.
 */
export function registerPermissionsIpc(controller: PermissionsController): void {
  ipcMain.handle(PERMISSION_CHANNELS.list, () => controller.list());
  ipcMain.handle(PERMISSION_CHANNELS.grant, (_e, id: PermissionId) => controller.grant(id));
  ipcMain.handle(PERMISSION_CHANNELS.revoke, (_e, id: PermissionId) => controller.revoke(id));
  ipcMain.handle(PERMISSION_CHANNELS.status, (_e, id: PermissionId) => controller.status(id));
}
