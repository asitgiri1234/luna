import { promises as fs } from "node:fs";

import { DocumentError } from "../../../shared/documents";
import type { PageText, ParsedDocument, RawMetadata } from "../types";

/**
 * # PDF parser (main process)
 *
 * Text-only extraction with `pdfjs-dist` (the legacy build, which runs
 * headless in Node without a DOM). We read text content per page and
 * preserve page boundaries plus line breaks (`hasEOL`). This is NOT OCR:
 * scanned/image-only PDFs simply yield little or no text, which the
 * pipeline reports as an empty document.
 */

// pdfjs is dynamically imported and typed loosely at the boundary; the
// bits we touch (numPages, getPage, getTextContent, getMetadata) are stable.
interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

/** Parses a PDF metadata date like `D:20230115120000Z` to epoch ms. */
function parsePdfDate(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(value);
  if (!match) return undefined;
  const [, y, mo = "01", d = "01", h = "00", mi = "00", s = "00"] = match;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return Number.isNaN(ms) ? undefined : ms;
}

export async function parsePdf(absPath: string): Promise<ParsedDocument> {
  const bytes = await fs.readFile(absPath).catch(() => {
    throw new DocumentError("file-missing", "The PDF could not be read from the workspace.");
  });

  // Legacy build = no DOM/worker requirements; safe in the main process.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
    }).promise;
  } catch {
    throw new DocumentError("corrupt", "This PDF could not be opened — it may be corrupted.");
  }

  const pages: PageText[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items as PdfTextItem[]) {
        if (typeof item.str === "string") text += item.str;
        if (item.hasEOL) text += "\n";
      }
      pages.push({ page: pageNumber, text });
      page.cleanup();
    }
  } catch {
    throw new DocumentError("corrupt", "This PDF could not be fully read — it may be damaged.");
  }

  let info: Record<string, unknown> = {};
  try {
    const meta = await doc.getMetadata();
    info = (meta.info as Record<string, unknown>) ?? {};
  } catch {
    // Metadata is best-effort; absence is fine.
  }
  const pageCount = doc.numPages;
  await doc.cleanup();

  const title = typeof info.Title === "string" && info.Title.trim() ? info.Title.trim() : undefined;
  const author =
    typeof info.Author === "string" && info.Author.trim() ? info.Author.trim() : undefined;
  const meta: RawMetadata = {
    title,
    author,
    creationDate: parsePdfDate(info.CreationDate),
    pageCount,
  };

  return { pages, meta, isMarkdown: false };
}
