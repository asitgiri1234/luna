import { promises as fs } from "node:fs";

import { DocumentError } from "../../../shared/documents";
import type { ParsedDocument } from "../types";

/**
 * # Plain-text / Markdown parser (main process)
 *
 * TXT and Markdown are already text — parsing is just a bounded read.
 * Markdown is flagged so the normalizer applies structure-aware handling
 * (fenced code, headings, lists, tables). No page concept, so the whole
 * file is page 1.
 */
export async function parseText(absPath: string, isMarkdown: boolean): Promise<ParsedDocument> {
  let text: string;
  try {
    text = await fs.readFile(absPath, "utf8");
  } catch {
    throw new DocumentError("file-missing", "The file could not be read from the workspace.");
  }
  // Strip a UTF-8 BOM if present so it doesn't leak into the first block.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  return {
    pages: [{ page: 1, text }],
    meta: { pageCount: 1 },
    isMarkdown,
  };
}
