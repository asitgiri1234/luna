# Luna — Document Intelligence

> Milestone 8.2. Turns an uploaded file (PDF / DOCX / TXT / Markdown)
> into a clean, normalized **document** plus ordered **chunks** that are
> ready for a future embedding / semantic-index step. There is **no**
> embedding, vector search, RAG, OCR, vision, or LLM here — only parsing,
> normalization, metadata, and chunking.

## 1. Folder structure

The pipeline is CPU + text work that needs Node (`fs`, `pdfjs`,
`mammoth`), so — like every other Node boundary in Luna — it runs in the
**main process**. The renderer keeps only its document layer (service,
store, UI). The IPC contract and document model live in `shared/`.

```
shared/documents.ts                    # contract: Document/Chunk model, options, channels, errors

electron/documents/
  types.ts                             # internal pipeline shapes (PageText, Block, …)
  parsers/
    index.ts                           # kind → parser dispatch
    pdf.parser.ts                      # pdfjs-dist (legacy, headless): text + pages + meta
    docx.parser.ts                     # mammoth: raw text
    text.parser.ts                     # TXT / Markdown read
  normalizers/index.ts                 # whitespace/unicode/line-break cleanup + block segmentation
  metadata/
    language.ts                        # embedding-free language guess
    index.ts                           # title/author/date + word/reading-time metrics
  chunking/index.ts                    # paragraph / fixed / sentence strategies
  indexing/index.ts                    # index prep: assign id / documentId / order
  pipeline.ts                          # parse → normalize → metadata → chunk → index
  document.repository.ts               # documents + document_chunks tables (transactional)
electron/controllers/documents.controller.ts   # orchestration; DocResult envelopes; idempotent
electron/ipc/documents.ipc.ts          # documents:* channels
drizzle/0004_*.sql                     # generated migration

src/documents/document.service.ts      # renderer IPC client (unwraps DocResult)
src/store/documents/documents.store.ts # per-file document state + lazy processing + detail view
src/lib/document-presentation.ts       # language names, reading-time / metric formatting
src/components/documents/
  DocumentStrip.tsx                    # card footer: Analyzing… / metrics / retry
  DocumentDetail.tsx                   # slide-in panel: metadata + preview + chunks
```

## 2. Parser architecture

Each parser is dedicated to one format and returns the **same**
`ParsedDocument` shape — ordered `PageText[]` plus container
`RawMetadata` — so every downstream stage is format-agnostic. Adding a
format is one parser file plus one `case` in `parsers/index.ts`.

| Format | Library | Text | Pages | Title/Author/Date |
| ------ | ------- | ---- | ----- | ----------------- |
| PDF    | `pdfjs-dist` (legacy, headless) | per-page, line breaks via `hasEOL` | native page count | from PDF info dict |
| DOCX   | `mammoth` (`extractRawText`) | paragraph text | 1 (no fixed pagination) | filename fallback |
| TXT    | `fs.readFile` | verbatim | 1 | filename fallback |
| MD     | `fs.readFile` (structure-aware) | verbatim | 1 | first heading / filename |

`pdfjs` and `mammoth` are heavy/native-ish, so they're **externalized**
from the main bundle (`vite.config.ts`) and required at runtime from
`node_modules` — the same treatment as `better-sqlite3`. This is text
extraction only: an image-only/scanned PDF yields little text and the
pipeline reports it as an **empty document** (there is no OCR).

## 3. Pipeline stages

```
parse ──► normalize ──► metadata ──► chunk ──► index-prep ──► store
```

- **Normalize** — NFC unicode; CRLF→LF; zero-width/control chars removed;
  form-feeds → line breaks; whitespace collapsed. Text is segmented into
  typed **blocks** (heading / paragraph / list / table / code). Markdown
  gets syntax-aware handling (`#` headings, fenced code, pipe tables);
  other formats fall back to blank-line paragraphs with a conservative
  heading heuristic.
- **Metadata** — title (container → first heading → filename), author,
  original date, page count, word count, reading time (≈220 wpm), and an
  embedding-free **language** guess (script ranges + Latin stop-word
  scoring).
- **Chunk → index-prep** — see below. Index-prep assigns each chunk a
  stable id, its document id, and its order.

## 4. Document schema

`documents` (one row per source file; the full normalized `content` is
kept for future re-chunking / embedding):

| Column | Notes |
| ------ | ----- |
| `id` | uuid |
| `source_file_id` | FK → `files.id`, `ON DELETE CASCADE` |
| `title`, `kind`, `language`, `author` | descriptive |
| `content` | full normalized text (not shipped whole; `preview` derived) |
| `word_count`, `page_count`, `paragraph_count`, `reading_time_minutes` | metrics |
| `document_created_at` | original authored date (epoch ms), nullable |
| `chunk_count`, `status` (`ready`/`failed`), `error` | processing result |
| `created_at`, `updated_at` | epoch ms |

`document_chunks` (ordered, cascade-deleted with the document):

| Column | Notes |
| ------ | ----- |
| `id` | uuid |
| `document_id` | FK → `documents.id`, `ON DELETE CASCADE` |
| `position` | 0-based order |
| `text` | the chunk |
| `metadata` | JSON: word/char counts, strategy, page, heading path |

Deleting a **file** cascades to its document, which cascades to its
chunks — no orphans. Re-processing replaces the prior document + chunks
in a single transaction.

## 5. Chunking strategy

One reusable engine, three strategies, all honoring a configurable
`maxChars` + `overlap` and attaching per-chunk metadata (word/char
counts, source page, nearest heading trail, strategy):

- **sentence** *(default)* — packs sentences across blocks up to the size
  limit, carrying sentence-level overlap into the next chunk. Best for
  retrieval.
- **paragraph** — one chunk per block (lists / tables / code kept
  intact); oversized blocks are windowed.
- **fixed** — character windows over the whole text, with overlap.

The output chunk shape — `{ id, documentId, text, position, metadata }` —
is exactly what an embedding step will consume.

## 6. Error handling

Failures are states, not crashes. Every controller call returns a
`DocResult`. Corrupt PDFs, empty/scanned files, and oversized documents
are caught and persisted as a `failed` document (with the reason), so the
Files page can show a "Couldn't read · Retry" affordance instead of
losing the file. Unsupported kinds and missing files return a classified
error and never create a row.

## 7. How Phase 8.3 (semantic index) plugs in

This milestone deliberately stops at "ready to embed":

- **`document_chunks` is the embedding queue.** Phase 8.3 reads chunks
  (already sized, ordered, and de-structured with heading context),
  computes a vector per `text`, and writes to a new `chunk_embeddings`
  table keyed by `chunk_id` — **no change** to parsing, normalization, or
  chunking.
- **`documents.content` enables re-chunking** under different
  `ChunkOptions` without re-parsing the original file.
- **The `DocumentRecord` handle** (per `source_file_id`) lets retrieval
  join hits back to the originating file and, later, to chat.
- **Chunk metadata** (`page`, `headingPath`) is ready to become
  citations in a future RAG answer.
- The chunking engine's strategy/size/overlap are already parameters, so
  tuning retrieval later is configuration, not new code.
```
