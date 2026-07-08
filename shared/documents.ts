/**
 * # Shared documents contract
 *
 * Wire types for the Document Intelligence layer, crossing IPC between
 * the renderer's document layer (`src/documents/`) and the main-process
 * pipeline (`electron/documents/`). Free of imports from either side.
 *
 * This milestone turns an uploaded file (PDF / DOCX / TXT / Markdown)
 * into a clean, normalized `DocumentRecord` plus ordered `DocumentChunk`s
 * that are ready for a FUTURE embedding / semantic-index step. There is
 * NO embedding, vector search, RAG, OCR, vision, or LLM here — only
 * parsing, normalization, metadata, and chunking.
 */

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

/** File kinds that carry extractable text (a subset of `FileKind`). */
export type DocumentKind = "pdf" | "docx" | "txt" | "md";

export const DOCUMENT_KINDS: readonly DocumentKind[] = ["pdf", "docx", "txt", "md"];

/** Narrows any file-kind string to a document kind we can parse. */
export function isDocumentKind(kind: string): kind is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(kind);
}

// ---------------------------------------------------------------------------
// Limits / tuning
// ---------------------------------------------------------------------------

/** Guard against pathologically large documents (chars of extracted text). */
export const MAX_DOCUMENT_CHARS = 4_000_000;

/** Average silent reading speed, used for the reading-time estimate. */
export const WORDS_PER_MINUTE = 220;

/** Characters of normalized text kept on the record for quick previews. */
export const PREVIEW_CHARS = 1500;

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

export type ChunkStrategy = "paragraph" | "fixed" | "sentence";

export interface ChunkOptions {
  strategy: ChunkStrategy;
  /** Target maximum characters per chunk. */
  maxChars: number;
  /** Characters of trailing overlap carried into the next chunk. */
  overlap: number;
}

/** Sentence-aware chunks with light overlap — a good default for retrieval. */
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  strategy: "sentence",
  maxChars: 1200,
  overlap: 150,
};

export interface ChunkMetadata {
  wordCount: number;
  charCount: number;
  strategy: ChunkStrategy;
  /** 1-based source page, when the parser preserved page boundaries. */
  page?: number;
  /** Nearest preceding heading trail, e.g. ["Intro", "Goals"]. */
  headingPath?: string[];
}

/**
 * One ordered slice of a document, ready to be embedded later. `position`
 * is the 0-based order within the document; `id` is stable.
 */
export interface DocumentChunk {
  id: string;
  documentId: string;
  position: number;
  text: string;
  metadata: ChunkMetadata;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type DocumentStatus = "ready" | "failed";

/**
 * The unified, persisted document. `content` (the full normalized text)
 * lives in the store but is not shipped on the record — use the chunks or
 * the `preview` for display. This is the stable handle a future semantic
 * index reads from.
 */
export interface DocumentRecord {
  id: string;
  sourceFileId: string;
  title: string;
  kind: DocumentKind;
  language: string;
  wordCount: number;
  pageCount: number;
  paragraphCount: number;
  readingTimeMinutes: number;
  author: string | null;
  /** Original authored date from file metadata (epoch ms), when known. */
  documentCreatedAt: number | null;
  chunkCount: number;
  /** First `PREVIEW_CHARS` of normalized text, for a quick preview. */
  preview: string;
  status: DocumentStatus;
  /** Failure reason when `status === "failed"`. */
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProcessDocumentInput {
  sourceFileId: string;
  /** Override the default chunking behavior. */
  chunkOptions?: Partial<ChunkOptions>;
  /** Re-run even if a document already exists for this file. */
  force?: boolean;
}

// ---------------------------------------------------------------------------
// Retrieval (query → relevant chunks). Produced by the main-process
// RetrieverService and shipped to the renderer's document-chat layer.
// ---------------------------------------------------------------------------

export interface RetrievedChunkMeta {
  position: number;
  page?: number;
  headingPath?: string[];
  wordCount: number;
  charCount: number;
}

export interface RetrievedDocumentMeta {
  id: string;
  sourceFileId: string;
  title: string;
  kind: DocumentKind;
  language: string;
  author: string | null;
}

/** One retrieved chunk with its similarity score and full context. */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  /** Cosine similarity in [-1, 1]; higher is more relevant. */
  score: number;
  text: string;
  chunk: RetrievedChunkMeta;
  document: RetrievedDocumentMeta;
}

/** A retrieval request over IPC. */
export interface RetrieveQuery {
  query: string;
  /** Top-K to return. */
  k?: number;
  /** Restrict to a single document. */
  documentId?: string;
  /** Minimum similarity to keep a result. */
  minScore?: number;
}

// ---------------------------------------------------------------------------
// OCR (image → text). Extracted text is stored as a normal `documents` row
// linked to the source image file, so it reuses the whole document schema.
// ---------------------------------------------------------------------------

export type OcrStatus = "queued" | "loading" | "recognizing" | "done" | "failed";

/** Progress event streamed while an image is being OCR'd. */
export interface OcrProgress {
  imageId: string;
  status: OcrStatus;
  /** 0…1 completion for the current phase. */
  progress: number;
}

// ---------------------------------------------------------------------------
// Vision (image understanding via a local vision model). Results are stored
// in the `documents.metadata` JSON of the image's document — no new schema.
// ---------------------------------------------------------------------------

export type VisionStatus = "queued" | "analyzing" | "done" | "failed";

/** Structured understanding of an image produced by a vision model. */
export interface VisionAnalysis {
  /** One short caption. */
  caption: string;
  /** A few sentences describing the image. */
  description: string;
  /** Salient objects the model reported (labels; empty if unsupported). */
  objects: string[];
  /** One-sentence summary of the overall scene. */
  sceneSummary: string;
  /** The vision model that produced this. */
  model: string;
  createdAt: number;
}

/** Progress event streamed while an image is being analyzed. */
export interface VisionProgress {
  imageId: string;
  status: VisionStatus;
  /** 0…1 completion. */
  progress: number;
}

// ---------------------------------------------------------------------------
// Errors / results
// ---------------------------------------------------------------------------

export type DocumentErrorCode =
  | "unsupported-kind"
  | "file-missing"
  | "empty-document"
  | "corrupt"
  | "too-large"
  | "db-unavailable"
  | "not-found"
  | "unknown";

export class DocumentError extends Error {
  constructor(
    public readonly code: DocumentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DocumentError";
  }
}

export type DocResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DocumentErrorCode; message: string };

// ---------------------------------------------------------------------------
// IPC channels
// ---------------------------------------------------------------------------

export const DOCUMENT_CHANNELS = {
  /** Parse → normalize → chunk → store for one uploaded file. */
  process: "documents:process",
  /** Fetch the document for a source file id (or null). */
  get: "documents:get",
  /** All stored document records. */
  list: "documents:list",
  /** Ordered chunks for a document id. */
  chunks: "documents:chunks",
  /** Delete a document and its chunks. */
  remove: "documents:remove",
  /** Query → Top-K relevant chunks (for document chat). */
  retrieve: "documents:retrieve",
  /** OCR one image into a document. */
  ocrExtract: "documents:ocr-extract",
  /** OCR several images. */
  ocrExtractBatch: "documents:ocr-extract-batch",
  /** Streamed OCR progress (main → renderer). */
  ocrProgress: "documents:ocr-progress",
  /** Analyze one image with the vision model. */
  visionAnalyze: "documents:vision-analyze",
  /** Analyze several images. */
  visionAnalyzeBatch: "documents:vision-analyze-batch",
  /** Fetch a cached image analysis (or null). */
  visionGet: "documents:vision-get",
  /** Streamed vision progress (main → renderer). */
  visionProgress: "documents:vision-progress",
} as const;
