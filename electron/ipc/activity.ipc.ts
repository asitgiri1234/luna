import { ipcMain } from "electron";

import { ACTIVITY_CHANNELS, type ActivityQuery } from "../../shared/activity";
import type { ActivityController } from "../controllers/activity.controller";

/**
 * # Activity IPC registration
 *
 * Binds the `activity:*` invoke channels to the injected controller.
 * Every handler returns a `DbResult` and never throws across IPC.
 */
export function registerActivityIpc(controller: ActivityController): void {
  ipcMain.handle(ACTIVITY_CHANNELS.list, (_e, query: ActivityQuery = {}) => controller.list(query));
  ipcMain.handle(ACTIVITY_CHANNELS.clear, () => controller.clear());
}
