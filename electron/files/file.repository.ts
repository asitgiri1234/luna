import { desc, eq } from "drizzle-orm";

import { type FileRecord, FileError } from "../../shared/files";
import { getDb } from "../backend/db/client";
import { files } from "../backend/db/schema";

/**
 * # File repository (main process)
 *
 * The only module that queries the `files` metadata table. Speaks in
 * `FileRecord` DTOs; the workspace module owns the bytes.
 */
export class FileRepository {
  insert(record: FileRecord): FileRecord {
    getDb().insert(files).values(record).run();
    return record;
  }

  list(): FileRecord[] {
    return getDb().select().from(files).orderBy(desc(files.createdAt)).all() as FileRecord[];
  }

  get(id: string): FileRecord | undefined {
    return getDb().select().from(files).where(eq(files.id, id)).get() as FileRecord | undefined;
  }

  /** First non-deleted file with a matching content hash (de-dup). */
  findByHash(hash: string): FileRecord | undefined {
    return getDb().select().from(files).where(eq(files.hash, hash)).get() as
      | FileRecord
      | undefined;
  }

  rename(id: string, filename: string): FileRecord {
    const updatedAt = Date.now();
    const result = getDb()
      .update(files)
      .set({ filename, updatedAt })
      .where(eq(files.id, id))
      .run();
    if (result.changes === 0) throw new FileError("not-found", `File "${id}" not found.`);
    return this.get(id)!;
  }

  delete(id: string): void {
    getDb().delete(files).where(eq(files.id, id)).run();
  }
}
