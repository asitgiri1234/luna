import { ipcMain } from "electron";

import { AI_CHANNELS, type AiStreamRequest } from "../../shared/ai";
import type { AiController } from "../controllers/ai.controller";

/**
 * # AI IPC registration
 *
 * Binds the `ai:*` channels (defined once in `shared/ai.ts`) to the
 * injected controller. This is the only place channel names meet
 * handlers — future domains (memory, tools, …) get their own
 * `<domain>.ipc.ts` alongside this one.
 */
export function registerAiIpc(controller: AiController): void {
  ipcMain.on(AI_CHANNELS.start, (event, request: AiStreamRequest) => {
    void controller.start(event.sender, request);
  });

  ipcMain.on(AI_CHANNELS.cancel, (_event, requestId: string) => {
    controller.cancel(requestId);
  });

  ipcMain.handle(AI_CHANNELS.health, (_event, providerId: string) =>
    controller.health(providerId),
  );
}
