import type { AiStreamEvent, AiStreamRequest, ProviderHealth } from "@shared/ai";
import type {
  ConversationMeta,
  CreateConversationInput,
  DbResult,
  SaveMessageInput,
  StoredMessage,
} from "@shared/conversations";

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

export interface LunaAiApi {
  start: (request: AiStreamRequest) => void;
  cancel: (requestId: string) => void;
  onEvent: (callback: (event: AiStreamEvent) => void) => () => void;
  health: (providerId: string) => Promise<ProviderHealth>;
}

export interface LunaConversationsApi {
  create: (input: CreateConversationInput) => Promise<DbResult<ConversationMeta>>;
  remove: (id: string) => Promise<DbResult<null>>;
  rename: (id: string, title: string) => Promise<DbResult<null>>;
  setPinned: (id: string, isPinned: boolean) => Promise<DbResult<null>>;
  list: () => Promise<DbResult<ConversationMeta[]>>;
  get: (id: string) => Promise<DbResult<ConversationMeta | null>>;
  saveMessage: (input: SaveMessageInput) => Promise<DbResult<null>>;
  deleteMessage: (id: string) => Promise<DbResult<null>>;
  loadMessages: (conversationId: string) => Promise<DbResult<StoredMessage[]>>;
  touch: (id: string, preview?: string) => Promise<DbResult<null>>;
}

export interface LunaApi {
  window: LunaWindowApi;
  ai: LunaAiApi;
  conversations: LunaConversationsApi;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    /** Present only when running inside Electron (injected by the preload script). */
    luna?: LunaApi;
  }
}
