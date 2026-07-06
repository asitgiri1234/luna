import { ipcMain } from "electron";

import { CHAT_CHANNELS, type ChatStartPayload } from "../../shared/ai";
import { cancelGeneration, startGeneration } from "../controllers/chat.controller";

/** Wires the chat channels to the chat controller. Call once at startup. */
export function registerChatIpc(): void {
  ipcMain.on(CHAT_CHANNELS.start, (event, payload: ChatStartPayload) => {
    void startGeneration(event.sender, payload);
  });

  ipcMain.on(CHAT_CHANNELS.cancel, (_event, requestId: string) => {
    cancelGeneration(requestId);
  });
}
