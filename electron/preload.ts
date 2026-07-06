import { contextBridge, ipcRenderer } from "electron";

import {
  AI_CHANNELS,
  type AiStreamEvent,
  type AiStreamRequest,
  type ProviderHealth,
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
  platform: process.platform,
};

contextBridge.exposeInMainWorld("luna", lunaApi);
