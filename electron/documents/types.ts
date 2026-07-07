import type { ChunkMetadata } from "../../shared/documents";

/**
 * # Document pipeline — internal types (main process)
 *
 * The shapes that flow between the pipeline stages
 * (parser → normalizer → metadata → chunking → indexing). Only
 * `DocumentRecord` / `DocumentChunk` (in `shared/documents.ts`) cross
 * IPC; everything here stays in the main process.
 */

/** One page of extracted text. TXT / DOCX / MD collapse to a single page. */
export interface PageText {
  page: number;
  text: string;
}

/** Raw metadata a parser can recover from the container itself. */
export interface RawMetadata {
  title?: string;
  author?: string;
  /** Original authored date (epoch ms), when the format records it. */
  creationDate?: number;
  pageCount: number;
}

/** A parser's output, before normalization. */
export interface ParsedDocument {
  pages: PageText[];
  meta: RawMetadata;
  /** Markdown gets structure-aware normalization (fences, headings, …). */
  isMarkdown: boolean;
}

export type BlockType = "heading" | "paragraph" | "list" | "table" | "code";

/** A normalized structural unit of the document. */
export interface Block {
  type: BlockType;
  text: string;
  /** Heading depth (1–6) when `type === "heading"`. */
  level?: number;
  /** 1-based source page this block came from. */
  page: number;
}

/** The normalizer's output: clean text plus structure. */
export interface NormalizedDocument {
  /** Full normalized text (blocks joined by blank lines). */
  content: string;
  blocks: Block[];
  /** Text of every non-heading block, in order. */
  paragraphs: string[];
}

/** A chunk before it is assigned an id / document id (index prep does that). */
export interface ChunkDraft {
  text: string;
  metadata: ChunkMetadata;
}
