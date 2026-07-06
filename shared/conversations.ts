/**
 * # Shared conversation-persistence contract
 *
 * Wire types for everything that crosses IPC between the renderer's
 * conversation layer (`src/ai/conversation/`) and the main-process
 * SQLite repository (`electron/backend/db/`). Keep it free of imports
 * from either side.
 *
 * IPC handlers return `DbResult<T>` instead of throwing, because
 * `ipcRenderer.invoke` flattens rejected errors into bare strings —
 * the renderer repository unwraps results back into `PersistenceError`.
 */

import type { ChatRole } from "./ai";

// ---------------------------------------------------------------------------
// Rows as the application sees them
// ---------------------------------------------------------------------------

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  lastMessagePreview: string;
  modelUsed: string | null;
  systemPromptVersion: string | null;
}

export interface StoredMessageMetadata {
  /** Generation was stopped before the response finished. */
  interrupted?: boolean;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  tokenCount: number | null;
  metadata: StoredMessageMetadata | null;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CreateConversationInput {
  title: string;
  modelUsed: string | null;
  systemPromptVersion: string | null;
}

export interface SaveMessageInput {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  tokenCount?: number;
  metadata?: StoredMessageMetadata | null;
  /** When set, also updates the conversation's preview + updatedAt atomically. */
  preview?: string;
}

// ---------------------------------------------------------------------------
// Errors / results
// ---------------------------------------------------------------------------

export type PersistenceErrorCode =
  /** The database could not be opened at all. */
  | "db-unavailable"
  /** The database opened but migrations failed to apply. */
  | "migration-failed"
  /** The referenced conversation does not exist. */
  | "not-found"
  | "unknown";

export class PersistenceError extends Error {
  constructor(
    public readonly code: PersistenceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PersistenceError";
  }
}

export type DbResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PersistenceErrorCode; message: string };

// ---------------------------------------------------------------------------
// IPC channels
// ---------------------------------------------------------------------------

export const CONVERSATION_CHANNELS = {
  create: "conversations:create",
  remove: "conversations:delete",
  rename: "conversations:rename",
  setPinned: "conversations:set-pinned",
  list: "conversations:list",
  get: "conversations:get",
  saveMessage: "conversations:save-message",
  deleteMessage: "conversations:delete-message",
  loadMessages: "conversations:load-messages",
  touch: "conversations:touch",
} as const;
