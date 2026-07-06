import type { ChatStartPayload, ChatStreamEvent } from "@shared/ai";

/**
 * Renderer-side declaration of the API exposed by `electron/preload.ts`
 * via `contextBridge.exposeInMainWorld("luna", ...)`.
 *
 * Keep this file in sync with the preload script.
 */
export interface LunaWindowApi {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
}

export interface LunaChatApi {
  start: (payload: ChatStartPayload) => void;
  cancel: (requestId: string) => void;
  onEvent: (callback: (event: ChatStreamEvent) => void) => () => void;
}

export interface LunaApi {
  window: LunaWindowApi;
  chat: LunaChatApi;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    /** Present only when running inside Electron (injected by the preload script). */
    luna?: LunaApi;
  }
}
