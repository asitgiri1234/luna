import type { OcrStatus } from "../../../shared/documents";

/**
 * # OCR types (main process, internal)
 *
 * The engine boundary used by the OCRService. The wire types (`OcrStatus`,
 * `OcrProgress`) live in `shared/documents.ts`; the extracted text is
 * stored as a normal `documents` row, so there is no OCR-specific record
 * type. This is text recognition only — no vision model, no detection.
 */

/** Reports progress of a single OCR run (phase + 0…1). */
export type OcrProgressReporter = (status: OcrStatus, progress: number) => void;

/**
 * A pluggable OCR engine. Turns an image on disk into text, reporting
 * progress. Implemented by the Tesseract engine; injectable for tests.
 */
export interface OcrEngine {
  recognize(absPath: string, onProgress?: OcrProgressReporter): Promise<string>;
  /** Releases any long-lived resources (e.g. the worker). */
  dispose(): Promise<void>;
}
