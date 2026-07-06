import type {
  ConversationMeta,
  CreateConversationInput,
  DbResult,
  SaveMessageInput,
  StoredMessage,
} from "@shared/conversations";
import { PersistenceError } from "@shared/conversations";
import type { LunaConversationsApi } from "@/types/electron";

import type { ConversationRepository } from "./conversation-repository";

/**
 * # IPC-backed conversation repository (renderer)
 *
 * Forwards every repository call over the preload bridge to the
 * main-process SQLite repository, and unwraps `DbResult` envelopes
 * back into typed `PersistenceError`s.
 *
 * Contains no storage logic — it is pure transport.
 */

function unwrap<T>(result: DbResult<T>): T {
  if (result.ok) return result.data;
  throw new PersistenceError(result.code, result.message);
}

const NO_BRIDGE = (): never => {
  throw new PersistenceError(
    "db-unavailable",
    "The desktop persistence bridge is unavailable. Launch Luna through Electron.",
  );
};

export class IpcConversationRepository implements ConversationRepository {
  constructor(private readonly bridge: LunaConversationsApi | undefined) {}

  private api(): LunaConversationsApi {
    return this.bridge ?? NO_BRIDGE();
  }

  async create(input: CreateConversationInput): Promise<ConversationMeta> {
    return unwrap(await this.api().create(input));
  }

  async remove(id: string): Promise<void> {
    unwrap(await this.api().remove(id));
  }

  async rename(id: string, title: string): Promise<void> {
    unwrap(await this.api().rename(id, title));
  }

  async setPinned(id: string, isPinned: boolean): Promise<void> {
    unwrap(await this.api().setPinned(id, isPinned));
  }

  async list(): Promise<ConversationMeta[]> {
    return unwrap(await this.api().list());
  }

  async get(id: string): Promise<ConversationMeta | null> {
    return unwrap(await this.api().get(id));
  }

  async saveMessage(input: SaveMessageInput): Promise<void> {
    unwrap(await this.api().saveMessage(input));
  }

  async deleteMessage(id: string): Promise<void> {
    unwrap(await this.api().deleteMessage(id));
  }

  async loadMessages(conversationId: string): Promise<StoredMessage[]> {
    return unwrap(await this.api().loadMessages(conversationId));
  }

  async touch(id: string, preview?: string): Promise<void> {
    unwrap(await this.api().touch(id, preview));
  }
}
