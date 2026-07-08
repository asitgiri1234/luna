/**
 * # Vision configuration
 *
 * The single place to tune image understanding. Mirrors the embedding
 * config: nothing else hardcodes the vision model or host. `VisionService`
 * reads `defaultVisionConfig` but accepts an override, so a future
 * settings surface can supply the user's chosen model without touching
 * the service.
 *
 * The model must be a vision-capable model pulled into Ollama, e.g.
 * `ollama pull llava`.
 */

export interface VisionConfig {
  providerId: string;
  /** Base URL of the local Ollama server. */
  host: string;
  /** Vision-capable model id, as Ollama knows it (configurable in settings). */
  model: string;
  /** Abort a single analysis after this long. */
  requestTimeoutMs: number;
}

export const defaultVisionConfig: VisionConfig = {
  providerId: "ollama",
  host: "http://127.0.0.1:11434",
  model: "llava",
  requestTimeoutMs: 120_000,
};
