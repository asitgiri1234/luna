import { contextBridge, ipcRenderer } from "electron";

import {
  CHAT_CHANNELS,
  type ChatStartPayload,
  type ChatStreamEvent,
} from "../shared/ai";

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
  chat: {
    start: (payload: ChatStartPayload): void =>
      ipcRenderer.send(CHAT_CHANNELS.start, payload),
    cancel: (requestId: string): void => ipcRenderer.send(CHAT_CHANNELS.cancel, requestId),
    onEvent: (callback: (event: ChatStreamEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: ChatStreamEvent): void =>
        callback(value);
      ipcRenderer.on(CHAT_CHANNELS.event, listener);
      return () => ipcRenderer.off(CHAT_CHANNELS.event, listener);
    },
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld("luna", lunaApi);
