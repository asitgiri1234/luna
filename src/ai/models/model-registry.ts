/**
 * # Model registry
 *
 * Static catalog of the models Luna knows how to run, with the
 * capabilities the rest of the core needs (context window for the
 * context manager, vision support for future file/vision features,
 * sensible default temperature per model).
 *
 * The *current* model is not decided here — it comes from `AiConfig`.
 * A future model-picker UI reads this registry; a future cloud
 * provider adds entries with its own `providerId`.
 */

export interface ModelInfo {
  /** Model id as the provider knows it (e.g. an Ollama tag). */
  id: string;
  /** Human-readable name for future UI. */
  name: string;
  /** Which provider serves this model. */
  providerId: string;
  /** Context window in tokens. */
  contextLength: number;
  defaultTemperature: number;
  supportsVision: boolean;
}

export const MODEL_REGISTRY: readonly ModelInfo[] = [
  {
    id: "qwen2.5:3b",
    name: "Qwen 2.5 3B",
    providerId: "ollama",
    contextLength: 32_768,
    defaultTemperature: 0.7,
    supportsVision: false,
  },
  {
    id: "gemma3:4b",
    name: "Gemma 3 4B",
    providerId: "ollama",
    contextLength: 131_072,
    defaultTemperature: 0.7,
    supportsVision: true,
  },
  {
    id: "llama3:8b",
    name: "Llama 3 8B",
    providerId: "ollama",
    contextLength: 8_192,
    defaultTemperature: 0.7,
    supportsVision: false,
  },
  {
    id: "phi3.5:3.8b",
    name: "Phi 3.5 Mini",
    providerId: "ollama",
    contextLength: 131_072,
    defaultTemperature: 0.6,
    supportsVision: false,
  },
];

/** Conservative fallback for models that are not in the registry. */
const FALLBACK_CONTEXT_LENGTH = 8_192;

export function getModel(id: string): ModelInfo | undefined {
  return MODEL_REGISTRY.find((model) => model.id === id);
}

/**
 * Resolves a model id to its info, falling back to conservative
 * defaults so an unregistered model still works.
 */
export function resolveModel(id: string): ModelInfo {
  return (
    getModel(id) ?? {
      id,
      name: id,
      providerId: "ollama",
      contextLength: FALLBACK_CONTEXT_LENGTH,
      defaultTemperature: 0.7,
      supportsVision: false,
    }
  );
}
