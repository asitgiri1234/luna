import type { VisionStatus } from "../../../shared/documents";

/**
 * # Vision types (main process, internal)
 *
 * The engine boundary used by the VisionService. The wire types
 * (`VisionAnalysis`, `VisionProgress`, `VisionStatus`) live in
 * `shared/documents.ts`; results are stored in the `documents.metadata`
 * JSON, so there is no vision-specific record type.
 *
 * This is image understanding (caption / description / objects / scene)
 * only — no image chat, OCR, or bounding-box object detection.
 */

/** The raw analysis fields a vision engine returns (pre-persistence). */
export interface VisionAnalysisData {
  caption: string;
  description: string;
  objects: string[];
  sceneSummary: string;
}

/** Reports progress of a single analysis (phase + 0…1). */
export type VisionProgressReporter = (status: VisionStatus, progress: number) => void;

/**
 * A pluggable vision engine. Turns an image on disk into a structured
 * analysis with the given model, reporting progress. Implemented by the
 * Ollama engine; injectable for tests.
 */
export interface VisionEngine {
  analyze(
    absPath: string,
    model: string,
    onProgress?: VisionProgressReporter,
  ): Promise<VisionAnalysisData>;
}
