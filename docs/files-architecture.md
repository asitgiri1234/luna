# Luna — File Upload Infrastructure

> Milestone 8. A local file-management layer only: import, store, and
> manage files. **No** document AI, embeddings, vector search, RAG,
> parsing, or OCR. Files are copied into the Luna Workspace and tracked
> in SQLite.

## 1. Folder structure

Filesystem work runs in the main process (Node `fs`/`crypto`); the
renderer is sandboxed and drives the UI.

```
shared/files.ts                      # contract: FileRecord, kinds, limits, channels, errors
electron/files/
  workspace.ts                       # copy+hash into workspace, delete, image preview
  file.repository.ts                 # files metadata table CRUD + hash lookup
electron/controllers/files.controller.ts   # orchestrates workspace + repo; FileOpResult
electron/ipc/files.ipc.ts            # files:* channels (+ picker dialog, progress)
drizzle/0003_files.sql               # generated migration

src/files/file.service.ts            # renderer IPC client (unwraps FileOpResult)
src/store/files/files.store.ts       # catalog + uploads + view state (search/sort/filter)
src/lib/file-presentation.tsx        # kind icons/labels, size/date formatting
src/components/files/
  FileDropzone.tsx                   # drag-drop → webUtils path → import
  FileCard.tsx                       # thumbnail/icon, metadata, rename/delete/open/reveal
  FilesToolbar.tsx                   # search, filter, sort, "Add files"
  UploadList.tsx                     # live upload progress rows
src/pages/files/FilesPage.tsx        # the Files page (card grid)
```

## 2. Storage architecture

Files are **copied**, never referenced by absolute path:

```
userData/
  luna.db                      # metadata (SQLite)
  workspace/
    files/
      <uuid>.<ext>             # the copied bytes, id-named to avoid collisions
```

- On import the file is streamed into `workspace/files/<id><ext>` while a
  **sha256** is computed in the same pass; the `storageLocation` stored
  in the DB is **relative** to the workspace root (e.g. `files/<id>.png`),
  so the workspace is self-contained and portable.
- **De-duplication**: if the new file's hash matches an existing record,
  the fresh copy is discarded and the existing file is returned
  (`duplicate: true`).
- **Validation**: unsupported extensions and files over the 25 MB limit
  are rejected before copying, with a classified error.
- **Delete** removes both the workspace file and the metadata row.
- **Rename** changes only the display `filename` (metadata); the stored
  file keeps its id-based name, so renames never touch disk layout.
- **Image previews** are returned as base64 data URLs by the main
  process (images ≤ 8 MB); non-images have no preview (only a type icon)
  — no parsing of document contents anywhere.

## 3. Database schema (`files`)

| Column            | Type    | Notes                                   |
| ----------------- | ------- | --------------------------------------- |
| `id`              | text PK | uuid                                    |
| `filename`        | text    | display name (user-editable)            |
| `type`            | text    | kind: pdf/docx/txt/md/png/jpeg/webp     |
| `size`            | integer | bytes                                   |
| `created_at`      | integer | epoch ms                                |
| `updated_at`      | integer | epoch ms                                |
| `hash`            | text    | sha256 (indexed, for de-dup)            |
| `storage_location`| text    | path **relative** to the workspace root |

Migration: `npm run db:generate` produced `drizzle/0003_files.sql`
(applied automatically at startup).

## 4. Import + data flow

```
Drag-drop File ──webUtils.getPathForFile──┐
File picker (dialog) ─────────────────────┤ absolute path(s)
                                          ▼
files.store.importPaths → fileService.import(uploadId, path)
                                          ▼  IPC
FilesController.import → workspace.copyIntoWorkspace (stream copy + sha256,
                         emits files:progress) → de-dup by hash → repository.insert
                                          ▼
FileRecord ──► store refresh ──► FileCard grid
```

Upload progress streams back on `files:progress` and drives the
per-file progress bars in `UploadList`.

## 5. Features (all local, no AI)

Drag & drop · file picker · multiple upload · preview card (image
thumbnail / type icon) · metadata (size, date, type) · copied local
storage · delete · rename · search by name · sort (date / name / size,
toggle direction) · filter (all / documents / images) · upload progress
· de-duplication.

## 6. Future extension points

- **Document AI / RAG (next milestones)**: `FileRecord` is the stable
  handle. A processing pipeline reads `storageLocation`, extracts text,
  and writes to new tables (`file_chunks`, embeddings) — the files layer
  itself doesn't change.
- **Custom `lunafile://` protocol**: swap the base64 preview for a
  streamed protocol handler to preview large files without loading them
  into memory.
- **Attach-to-chat**: the chat composer can reference `FileRecord`s so a
  future vision/parsing milestone feeds file content to the model.
- **Tags / folders / collections**: additive columns or a join table;
  the store's view state already models search/sort/filter.
- **More types**: extend `EXTENSION_KINDS` + `KIND_META`; the pipeline is
  type-agnostic.
- **Content hashing already in place** enables future integrity checks,
  sync, and dedupe across a shared workspace.
```
