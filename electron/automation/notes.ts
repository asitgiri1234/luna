import { promises as fs } from "node:fs";
import path from "node:path";

import { app, shell } from "electron";
import { desc, eq } from "drizzle-orm";

import {
  AutomationError,
  type CreateNoteInput,
  type NoteRecord,
  type UpdateNoteInput,
} from "../../shared/automation";
import { createLogger } from "../../shared/logger";
import { getDb } from "../backend/db/client";
import { notes } from "../backend/db/schema";

/**
 * # Notes automation (main process)
 *
 * Notes are Markdown files under `userData/notes/`, with metadata in the
 * `notes` table so they can be listed and opened. Storing the body on
 * disk means "open note" hands off to the user's default editor.
 */

const log = createLogger("main:automation:notes");

function notesDir(): string {
  return path.join(app.getPath("userData"), "notes");
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "note"
  );
}

export async function createNote(input: CreateNoteInput): Promise<NoteRecord> {
  const dir = notesDir();
  await fs.mkdir(dir, { recursive: true });
  const id = crypto.randomUUID();
  const now = Date.now();
  const filePath = path.join(dir, `${slugify(input.title)}-${id.slice(0, 8)}.md`);

  const body = `# ${input.title}\n\n${input.content}\n`;
  await fs.writeFile(filePath, body, "utf8");

  const record: NoteRecord = {
    id,
    title: input.title,
    path: filePath,
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(notes).values(record).run();
  log.info("note created", { id });
  return record;
}

export async function updateNote(input: UpdateNoteInput): Promise<NoteRecord> {
  const row = getDb().select().from(notes).where(eq(notes.id, input.id)).get() as
    | NoteRecord
    | undefined;
  if (!row) throw new AutomationError("not-found", `Note "${input.id}" not found.`);

  await fs.writeFile(row.path, input.content, "utf8").catch(() => {
    throw new AutomationError("file-missing", `Note file for "${input.id}" is missing.`);
  });
  const updatedAt = Date.now();
  getDb().update(notes).set({ updatedAt }).where(eq(notes.id, input.id)).run();
  return { ...row, updatedAt };
}

export async function openNote(id: string): Promise<void> {
  const row = getDb().select().from(notes).where(eq(notes.id, id)).get() as
    | NoteRecord
    | undefined;
  if (!row) throw new AutomationError("not-found", `Note "${id}" not found.`);
  const error = await shell.openPath(row.path);
  if (error) throw new AutomationError("file-missing", error);
}

export function listNotes(): NoteRecord[] {
  return getDb().select().from(notes).orderBy(desc(notes.updatedAt)).all() as NoteRecord[];
}
