import { DocumentError } from "../../../shared/documents";
import type { ParsedDocument } from "../types";

/**
 * # DOCX parser (main process)
 *
 * Uses `mammoth` to extract the raw text of a Word document. Paragraphs
 * arrive blank-line separated, which the normalizer segments into
 * blocks. DOCX has no fixed pagination, so it is treated as a single
 * page. Core properties (title/author) aren't exposed by raw-text
 * extraction; those fall back to file-based defaults downstream.
 */
export async function parseDocx(absPath: string): Promise<ParsedDocument> {
  // Lazy, so the heavy parser only loads when a DOCX is actually processed.
  const mammoth = await import("mammoth");
  const extract = mammoth.extractRawText ?? mammoth.default?.extractRawText;

  let text: string;
  try {
    const result = await extract({ path: absPath });
    text = result.value ?? "";
  } catch {
    throw new DocumentError("corrupt", "This DOCX file could not be read — it may be corrupted.");
  }

  return {
    pages: [{ page: 1, text }],
    meta: { pageCount: 1 },
    isMarkdown: false,
  };
}
