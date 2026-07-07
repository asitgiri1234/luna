import { WORDS_PER_MINUTE } from "../../../shared/documents";
import type { FileRecord } from "../../../shared/files";
import type { NormalizedDocument, ParsedDocument } from "../types";
import { detectLanguage } from "./language";

export { detectLanguage };

/**
 * # Metadata extractor (main process)
 *
 * Derives the document's descriptive metrics from the parser's container
 * metadata plus the normalized text. Container metadata (title/author/
 * date) is preferred when present; otherwise sensible fallbacks are used
 * (title ← first heading ← filename).
 */

export interface DocumentMetrics {
  title: string;
  author: string | null;
  documentCreatedAt: number | null;
  pageCount: number;
  wordCount: number;
  paragraphCount: number;
  readingTimeMinutes: number;
  language: string;
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/** Minutes to read `wordCount` words at an average pace (0 for empty text). */
export function readingTimeMinutes(wordCount: number): number {
  if (wordCount === 0) return 0;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

function fallbackTitle(normalized: NormalizedDocument, file: FileRecord): string {
  const firstHeading = normalized.blocks.find((block) => block.type === "heading");
  if (firstHeading && firstHeading.text.length <= 120) return firstHeading.text;
  return file.filename.replace(/\.[^.]+$/, "").trim() || file.filename;
}

export function extractMetadata(
  parsed: ParsedDocument,
  normalized: NormalizedDocument,
  file: FileRecord,
): DocumentMetrics {
  const wordCount = countWords(normalized.content);
  const title =
    parsed.meta.title && parsed.meta.title.length <= 200
      ? parsed.meta.title
      : fallbackTitle(normalized, file);

  return {
    title,
    author: parsed.meta.author ?? null,
    documentCreatedAt: parsed.meta.creationDate ?? null,
    pageCount: Math.max(1, parsed.meta.pageCount),
    wordCount,
    paragraphCount: normalized.paragraphs.length,
    readingTimeMinutes: readingTimeMinutes(wordCount),
    language: detectLanguage(normalized.content),
  };
}
