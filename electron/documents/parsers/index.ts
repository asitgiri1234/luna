import { type DocumentKind, DocumentError } from "../../../shared/documents";
import type { ParsedDocument } from "../types";
import { parseDocx } from "./docx.parser";
import { parsePdf } from "./pdf.parser";
import { parseText } from "./text.parser";

/**
 * # Parser registry (main process)
 *
 * Dispatches a document kind to its dedicated parser. Every parser
 * returns the same `ParsedDocument` shape, so the rest of the pipeline
 * is format-agnostic. Adding a format = one parser + one case here.
 */
export function parseDocument(kind: DocumentKind, absPath: string): Promise<ParsedDocument> {
  switch (kind) {
    case "pdf":
      return parsePdf(absPath);
    case "docx":
      return parseDocx(absPath);
    case "md":
      return parseText(absPath, true);
    case "txt":
      return parseText(absPath, false);
    default:
      throw new DocumentError("unsupported-kind", `No parser for "${kind}" documents.`);
  }
}
