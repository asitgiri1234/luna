import { contextBridge, ipcRenderer } from "electron";

import {
  AI_CHANNELS,
  type AiStreamEvent,
  type AiStreamRequest,
  type ProviderHealth,
} from "../shared/ai";
import {
  CONVERSATION_CHANNELS,
  type ConversationMeta,
  type CreateConversationInput,
  type DbResult,
  type SaveMessageInput,
  type StoredMessage,
} from "../shared/conversations";

/**
 * The only bridge between the renderer and the main process.
 * Keep this surface minimal and typed — everything exposed here is
 * reachable from web content.
 *
 * The renderer-side type declaration lives in `src/types/electron.d.ts`.
 */
const lunaApi = {
  window: {
    minimize: (): void => ipcRenderer.send("window:minimize"),
    toggleMaximize: (): void => ipcRenderer.send("window:toggle-maximize"),
    close: (): void => ipcRenderer.send("window:close"),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window:is-maximized"),
    onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: boolean): void =>
        callback(value);
      ipcRenderer.on("window:maximized-changed", listener);
      return () => ipcRenderer.off("window:maximized-changed", listener);
    },
  },
  ai: {
    start: (request: AiStreamRequest): void => ipcRenderer.send(AI_CHANNELS.start, request),
    cancel: (requestId: string): void => ipcRenderer.send(AI_CHANNELS.cancel, requestId),
    onEvent: (callback: (event: AiStreamEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: AiStreamEvent): void =>
        callback(value);
      ipcRenderer.on(AI_CHANNELS.event, listener);
      return () => ipcRenderer.off(AI_CHANNELS.event, listener);
    },
    health: (providerId: string): Promise<ProviderHealth> =>
      ipcRenderer.invoke(AI_CHANNELS.health, providerId),
  },
  conversations: {
    create: (input: CreateConversationInput): Promise<DbResult<ConversationMeta>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.create, input),
    remove: (id: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.remove, id),
    rename: (id: string, title: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.rename, id, title),
    setPinned: (id: string, isPinned: boolean): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.setPinned, id, isPinned),
    list: (): Promise<DbResult<ConversationMeta[]>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.list),
    get: (id: string): Promise<DbResult<ConversationMeta | null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.get, id),
    saveMessage: (input: SaveMessageInput): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.saveMessage, input),
    deleteMessage: (id: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.deleteMessage, id),
    loadMessages: (conversationId: string): Promise<DbResult<StoredMessage[]>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.loadMessages, conversationId),
    touch: (id: string, preview?: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.touch, id, preview),
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld("luna", lunaApi);
