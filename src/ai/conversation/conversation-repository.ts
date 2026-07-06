import type {
  ConversationMeta,
  CreateConversationInput,
  SaveMessageInput,
  StoredMessage,
} from "@shared/conversations";

/**
 * # Conversation repository (renderer interface)
 *
 * The persistence seam of the conversation layer. The conversation
 * manager and store depend only on this interface; the IPC-backed
 * SQLite implementation is injected by the composition root.
 *
 * All methods reject with `PersistenceError` (see
 * `shared/conversations.ts`) so callers can degrade gracefully —
 * chatting must keep working even when the database is unavailable.
 *
 * ## Extension point
 * The Memory Engine will consume this same interface to mine past
 * conversations; tests inject an in-memory implementation.
 */
export interface ConversationRepository {
  create(input: CreateConversationInput): Promise<ConversationMeta>;
  remove(id: string): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  setPinned(id: string, isPinned: boolean): Promise<void>;
  list(): Promise<ConversationMeta[]>;
  get(id: string): Promise<ConversationMeta | null>;
  saveMessage(input: SaveMessageInput): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  loadMessages(conversationId: string): Promise<StoredMessage[]>;
  touch(id: string, preview?: string): Promise<void>;
}
