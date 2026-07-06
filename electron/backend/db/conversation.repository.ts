import { asc, desc, eq } from "drizzle-orm";

import {
  type ConversationMeta,
  type CreateConversationInput,
  PersistenceError,
  type SaveMessageInput,
  type StoredMessage,
  type StoredMessageMetadata,
} from "../../../shared/conversations";
import { createLogger } from "../../../shared/logger";
import type { Db } from "./client";
import { conversations, messages } from "./schema";

/**
 * # Conversation repository (main process)
 *
 * The ONLY module that runs queries against the database. Everything
 * above it (controller, IPC, renderer) speaks in `ConversationMeta` /
 * `StoredMessage` DTOs from the shared contract.
 *
 * Robustness rules:
 * - `saveMessage` inserts the message and bumps the conversation's
 *   `updatedAt`/preview in one transaction, so a crash can't leave the
 *   sidebar ordering out of sync with the content.
 * - `loadMessages` never lets one corrupt row poison a conversation:
 *   unparseable metadata degrades to `null`, structurally broken rows
 *   are skipped and logged.
 */

const log = createLogger("main:db:conversations");

const PREVIEW_MAX_LENGTH = 120;

function parseMetadata(raw: string | null, messageId: string): StoredMessageMetadata | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as StoredMessageMetadata)
      : null;
  } catch {
    log.warn("corrupt message metadata ignored", { messageId });
    return null;
  }
}

export class ConversationRepository {
  constructor(private readonly db: Db) {}

  createConversation(input: CreateConversationInput): ConversationMeta {
    const now = Date.now();
    const row = {
      id: crypto.randomUUID(),
      title: input.title,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      lastMessagePreview: "",
      modelUsed: input.modelUsed,
      systemPromptVersion: input.systemPromptVersion,
    };
    this.db.insert(conversations).values(row).run();
    return row;
  }

  deleteConversation(id: string): void {
    // Messages cascade via the foreign key.
    this.db.delete(conversations).where(eq(conversations.id, id)).run();
  }

  renameConversation(id: string, title: string): void {
    const result = this.db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, id))
      .run();
    if (result.changes === 0) {
      throw new PersistenceError("not-found", `Conversation "${id}" does not exist.`);
    }
  }

  pinConversation(id: string, isPinned: boolean): void {
    const result = this.db
      .update(conversations)
      .set({ isPinned })
      .where(eq(conversations.id, id))
      .run();
    if (result.changes === 0) {
      throw new PersistenceError("not-found", `Conversation "${id}" does not exist.`);
    }
  }

  /** All conversations: pinned first, then most recently updated. */
  listConversations(): ConversationMeta[] {
    return this.db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.isPinned), desc(conversations.updatedAt))
      .all();
  }

  getConversation(id: string): ConversationMeta | null {
    const row = this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .get();
    return row ?? null;
  }

  saveMessage(input: SaveMessageInput): void {
    const exists = this.getConversation(input.conversationId);
    if (!exists) {
      throw new PersistenceError(
        "not-found",
        `Conversation "${input.conversationId}" does not exist.`,
      );
    }
    this.db.transaction((tx) => {
      tx.insert(messages)
        .values({
          id: input.id,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          createdAt: input.createdAt,
          tokenCount: input.tokenCount ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        })
        .run();
      if (input.preview !== undefined) {
        tx.update(conversations)
          .set({
            updatedAt: Date.now(),
            lastMessagePreview: input.preview.slice(0, PREVIEW_MAX_LENGTH),
          })
          .where(eq(conversations.id, input.conversationId))
          .run();
      }
    });
  }

  /** Supports regenerate: the replaced assistant message is removed. */
  deleteMessage(id: string): void {
    this.db.delete(messages).where(eq(messages.id, id)).run();
  }

  loadMessages(conversationId: string): StoredMessage[] {
    const rows = this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .all();

    const result: StoredMessage[] = [];
    for (const row of rows) {
      if (typeof row.content !== "string" || typeof row.role !== "string") {
        log.warn("skipping corrupt message row", { messageId: row.id, conversationId });
        continue;
      }
      result.push({
        id: row.id,
        conversationId: row.conversationId,
        role: row.role as StoredMessage["role"],
        content: row.content,
        createdAt: row.createdAt,
        tokenCount: row.tokenCount,
        metadata: parseMetadata(row.metadata, row.id),
      });
    }
    return result;
  }

  updateTimestamp(id: string, preview?: string): void {
    const patch: { updatedAt: number; lastMessagePreview?: string } = { updatedAt: Date.now() };
    if (preview !== undefined) patch.lastMessagePreview = preview.slice(0, PREVIEW_MAX_LENGTH);
    this.db.update(conversations).set(patch).where(eq(conversations.id, id)).run();
  }
}
