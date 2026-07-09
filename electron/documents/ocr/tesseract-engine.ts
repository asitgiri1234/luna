import path from "node:path";

import { app } from "electron";

import { createLogger } from "../../../shared/logger";
import type { OcrEngine, OcrProgressReporter } from "./ocr.types";

/**
 * # Tesseract OCR engine (main process)
 *
 * Local text recognition via `tesseract.js` (WASM Tesseract) — classic
 * OCR, not a vision model. The worker is created once and reused across
 * images. The English language data is cached under the app's user-data
 * directory after the first download.
 *
 * `tesseract.js` is externalized from the main bundle (see vite config)
 * and required at runtime, like the other heavy parsers.
 */

const log = createLogger("main:ocr:tesseract");

/** Minimal shape of the tesseract worker we use (avoids leaking its types). */
interface TesseractWorker {
  recognize(image: string): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

export class TesseractEngine implements OcrEngine {
  private workerPromise: Promise<TesseractWorker> | null = null;
  /** Set for the duration of one `recognize` call so progress is routed. */
  private reporter: OcrProgressReporter | null = null;

  private worker(): Promise<TesseractWorker> {
    if (this.workerPromise) return this.workerPromise;
    this.workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const cachePath = path.join(app.getPath("userData"), "ocr-cache");
      const worker = await createWorker("eng", 1, {
        cachePath,
        logger: (m: { status?: string; progress?: number }) => {
          if (!this.reporter) return;
          const progress = typeof m.progress === "number" ? m.progress : 0;
          const status = m.status?.includes("recogni") ? "recognizing" : "loading";
          this.reporter(status, progress);
        },
        // Without this, a rejected job (e.g. a corrupt image) makes
        // tesseract.js `throw` inside its worker message handler, which
        // surfaces as an uncaught exception (an Electron error dialog).
        // The recognize() promise still rejects, so callers handle it.
        errorHandler: (error: unknown) => {
          log.warn("tesseract worker error", { message: String(error) });
        },
      });
      log.info("tesseract worker ready", { cachePath });
      return worker as unknown as TesseractWorker;
    })().catch((error) => {
      this.workerPromise = null; // allow a later retry
      throw error;
    });
    return this.workerPromise;
  }

  async recognize(absPath: string, onProgress?: OcrProgressReporter): Promise<string> {
    this.reporter = onProgress ?? null;
    try {
      const worker = await this.worker();
      const { data } = await worker.recognize(absPath);
      return data.text ?? "";
    } finally {
      this.reporter = null;
    }
  }

  async dispose(): Promise<void> {
    if (!this.workerPromise) return;
    const worker = await this.workerPromise.catch(() => null);
    await worker?.terminate();
    this.workerPromise = null;
  }
}
