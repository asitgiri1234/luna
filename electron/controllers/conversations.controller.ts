import {
  type ConversationMeta,
  type CreateConversationInput,
  type DbResult,
  PersistenceError,
  type SaveMessageInput,
  type StoredMessage,
} from "../../shared/conversations";
import { createLogger } from "../../shared/logger";
import { activityService } from "../activity/activity.service";
import { ConversationRepository } from "../backend/db/conversation.repository";
import { getDb } from "../backend/db/client";

/**
 * # Conversations controller (main process)
 *
 * Translates IPC calls into repository calls and every failure into a
 * `DbResult` (invoke rejections lose error metadata across IPC, so
 * errors travel as data). The repository is resolved lazily per call:
 * if the database failed to open or migrate, each call cleanly returns
 * the classified startup failure instead of crashing at wire-up time.
 */

const log = createLogger("main:conversations");

function run<T>(operation: string, fn: () => T): DbResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    const code = error instanceof PersistenceError ? error.code : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    log.warn("repository operation failed", { operation, code, message });
    return { ok: false, code, message };
  }
}

export class ConversationsController {
  private repository(): ConversationRepository {
    return new ConversationRepository(getDb());
  }

  create(input: CreateConversationInput): DbResult<ConversationMeta> {
    const result = run("create", () => this.repository().createConversation(input));
    if (result.ok) {
      activityService.logActivity({
        type: "conversation-started",
        description: `Started conversation "${result.data.title}"`,
        metadata: { conversationId: result.data.id },
      });
    }
    return result;
  }

  remove(id: string): DbResult<null> {
    return run("remove", () => {
      this.repository().deleteConversation(id);
      return null;
    });
  }

  rename(id: string, title: string): DbResult<null> {
    return run("rename", () => {
      this.repository().renameConversation(id, title);
      return null;
    });
  }

  setPinned(id: string, isPinned: boolean): DbResult<null> {
    return run("setPinned", () => {
      this.repository().pinConversation(id, isPinned);
      return null;
    });
  }

  list(): DbResult<ConversationMeta[]> {
    return run("list", () => this.repository().listConversations());
  }

  get(id: string): DbResult<ConversationMeta | null> {
    return run("get", () => this.repository().getConversation(id));
  }

  saveMessage(input: SaveMessageInput): DbResult<null> {
    const result = run("saveMessage", () => {
      this.repository().saveMessage(input);
      return null;
    });
    // Only user turns count as a "Message Sent"; assistant turns are the reply.
    if (result.ok && input.role === "user") {
      activityService.logActivity({
        type: "message-sent",
        description: "Sent a message",
        metadata: { conversationId: input.conversationId },
      });
    }
    return result;
  }

  deleteMessage(id: string): DbResult<null> {
    return run("deleteMessage", () => {
      this.repository().deleteMessage(id);
      return null;
    });
  }

  loadMessages(conversationId: string): DbResult<StoredMessage[]> {
    return run("loadMessages", () => this.repository().loadMessages(conversationId));
  }

  touch(id: string, preview?: string): DbResult<null> {
    return run("touch", () => {
      this.repository().updateTimestamp(id, preview);
      return null;
    });
  }
}
