import { ipcMain } from "electron";

import {
  CONVERSATION_CHANNELS,
  type CreateConversationInput,
  type SaveMessageInput,
} from "../../shared/conversations";
import type { ConversationsController } from "../controllers/conversations.controller";

/**
 * # Conversations IPC registration
 *
 * Binds the `conversations:*` channels to the injected controller.
 * All handlers are invoke-based (request/response) and return
 * `DbResult` values — they never throw across the boundary.
 */
export function registerConversationsIpc(controller: ConversationsController): void {
  ipcMain.handle(CONVERSATION_CHANNELS.create, (_e, input: CreateConversationInput) =>
    controller.create(input),
  );
  ipcMain.handle(CONVERSATION_CHANNELS.remove, (_e, id: string) => controller.remove(id));
  ipcMain.handle(CONVERSATION_CHANNELS.rename, (_e, id: string, title: string) =>
    controller.rename(id, title),
  );
  ipcMain.handle(CONVERSATION_CHANNELS.setPinned, (_e, id: string, isPinned: boolean) =>
    controller.setPinned(id, isPinned),
  );
  ipcMain.handle(CONVERSATION_CHANNELS.list, () => controller.list());
  ipcMain.handle(CONVERSATION_CHANNELS.get, (_e, id: string) => controller.get(id));
  ipcMain.handle(CONVERSATION_CHANNELS.saveMessage, (_e, input: SaveMessageInput) =>
    controller.saveMessage(input),
  );
  ipcMain.handle(CONVERSATION_CHANNELS.deleteMessage, (_e, id: string) =>
    controller.deleteMessage(id),
  );
  ipcMain.handle(CONVERSATION_CHANNELS.loadMessages, (_e, conversationId: string) =>
    controller.loadMessages(conversationId),
  );
  ipcMain.handle(CONVERSATION_CHANNELS.touch, (_e, id: string, preview?: string) =>
    controller.touch(id, preview),
  );
}
