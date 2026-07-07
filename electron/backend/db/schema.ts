import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

/**
 * Personal Memory Engine. Durable facts the user has approved Luna to
 * remember. `source_conversation_id` is nullable and set to null when
 * the originating conversation is deleted, so the memory survives.
 */
export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    confidence: real("confidence").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    lastUsed: integer("last_used"),
    sourceConversationId: text("source_conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" },
    ),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("idx_memories_category").on(table.category)],
);

/**
 * "Always / never remember similar" rules the user created from an
 * approval card. `tokens` is a space-joined bag of words describing the
 * candidate a rule generalizes from; matching is by token similarity.
 */
export const memoryRules = sqliteTable("memory_rules", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  tokens: text("tokens").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Locally stored reminders scheduled by the automation engine. */
export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  remindAt: integer("remind_at").notNull(),
  createdAt: integer("created_at").notNull(),
  notified: integer("notified", { mode: "boolean" }).notNull().default(false),
});

/**
 * Note metadata; the note body lives in a Markdown file on disk (see
 * `electron/automation/notes.ts`) so notes open in the user's editor.
 */
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  path: text("path").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Uploaded files. Bytes are copied into the Luna Workspace;
 * `storage_location` is relative to the workspace root (never absolute),
 * so the workspace stays portable. `hash` (sha256) enables de-duplication.
 */
export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    filename: text("filename").notNull(),
    type: text("type").notNull(),
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    hash: text("hash").notNull(),
    storageLocation: text("storage_location").notNull(),
  },
  (table) => [index("idx_files_hash").on(table.hash)],
);
