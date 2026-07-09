import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/**
 * Document Intelligence: the structured document produced from an
 * uploaded file (PDF / DOCX / TXT / Markdown). `content` is the full
 * normalized text (kept for future re-chunking / embedding); `metadata`
 * is raw JSON text for forward-compatible extras. Deleting the source
 * file cascades to its document, which cascades to its chunks.
 */
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    sourceFileId: text("source_file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    language: text("language").notNull(),
    wordCount: integer("word_count").notNull(),
    pageCount: integer("page_count").notNull(),
    paragraphCount: integer("paragraph_count").notNull(),
    readingTimeMinutes: integer("reading_time_minutes").notNull(),
    author: text("author"),
    documentCreatedAt: integer("document_created_at"),
    chunkCount: integer("chunk_count").notNull().default(0),
    status: text("status").notNull(),
    error: text("error"),
    metadata: text("metadata"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_documents_source_file").on(table.sourceFileId)],
);

/**
 * Privacy Dashboard: the live state of each capability Luna uses. Only
 * `status` + `last_used` are stored; the name/description/reason are
 * static metadata in `shared/permissions.ts` (PERMISSION_CATALOG), so
 * copy changes never need a migration. `id` is a stable PermissionId.
 */
export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  lastUsed: integer("last_used"),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Ordered, chunked slices of a document, prepared for a future
 * embedding / semantic-index milestone. `metadata` is raw JSON text
 * (page, heading path, counts, strategy). No vectors are stored yet.
 */
export const documentChunks = sqliteTable(
  "document_chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    metadata: text("metadata"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_document_chunks_document").on(table.documentId)],
);

/**
 * Vector embeddings for document chunks, produced by a local embedding
 * model (via Ollama). One row per (chunk, model): the unique index lets
 * the embedding service skip chunks that already have an embedding for a
 * given model. `embedding` is the vector serialized as a JSON array of
 * numbers; `dimensions` is its length. Deleting a chunk cascades here.
 *
 * This milestone only PRODUCES and stores embeddings — there is no
 * vector search / retrieval yet.
 */
export const chunkEmbeddings = sqliteTable(
  "chunk_embeddings",
  {
    id: text("id").primaryKey(),
    chunkId: text("chunk_id")
      .notNull()
      .references(() => documentChunks.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    embedding: text("embedding").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_chunk_embeddings_chunk").on(table.chunkId),
    uniqueIndex("idx_chunk_embeddings_chunk_model").on(table.chunkId, table.model),
  ],
);
