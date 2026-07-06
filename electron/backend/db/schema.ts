import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * # Database schema (Drizzle ORM, SQLite)
 *
 * Source of truth for the on-disk shape. Changing anything here
 * requires generating a migration: `npm run db:generate`.
 *
 * `metadata` is stored as raw JSON text (not drizzle's json mode) so
 * a corrupt row degrades to a per-row parse failure the repository can
 * handle gracefully instead of poisoning a whole query.
 */

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  lastMessagePreview: text("last_message_preview").notNull().default(""),
  modelUsed: text("model_used"),
  systemPromptVersion: text("system_prompt_version"),
});

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
    tokenCount: integer("token_count"),
    metadata: text("metadata"),
  },
  (table) => [index("idx_messages_conversation").on(table.conversationId)],
);
