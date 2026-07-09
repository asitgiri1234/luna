import { defaultAiConfig } from "@/ai/config/ai.config";
import { MODEL_REGISTRY } from "@/ai/models/model-registry";

/**
 * # AI settings types (renderer)
 *
 * The user-tunable AI preferences and the option catalogs the Settings
 * page renders from. AI settings layer on top of the existing
 * `AiConfig` (see `ai/config/ai.config.ts`): the overlapping fields are
 * applied onto the live `aiCore.config` so changes take effect on the
 * next request, and the two "default mode" flags are read by the chat /
 * documents stores. Persisted locally (localStorage) — no IPC, no DB.
 */

export interface AISettings {
  /** Model id served by the provider (see the model registry). */
  model: string;
  temperature: number;
  topP: number;
  /** Cap on generated tokens per response. */
  maxTokens: number;
  /** History budget (tokens) used to fit the prompt to the context window. */
  contextWindow: number;
  streaming: boolean;
  autoSaveConversations: boolean;
  /** Whether new chats start in document-grounded ("Chat with Documents") mode. */
  defaultDocumentChatMode: boolean;
  /** Whether opening an un-analyzed image auto-runs vision analysis. */
  defaultVisionAnalysis: boolean;
}

/** Defaults reuse the existing AiConfig so behavior is unchanged out of the box. */
export const DEFAULT_AI_SETTINGS: AISettings = {
  model: defaultAiConfig.model,
  temperature: defaultAiConfig.temperature,
  topP: defaultAiConfig.topP,
  maxTokens: defaultAiConfig.maxTokens,
  contextWindow: 32_768,
  streaming: defaultAiConfig.streaming,
  autoSaveConversations: true,
  defaultDocumentChatMode: false,
  defaultVisionAnalysis: false,
};

/** localStorage key holding the serialized {@link AISettings}. */
export const AI_SETTINGS_STORAGE_KEY = "luna.ai-settings";

// ---------------------------------------------------------------------------
// Option catalogs (drive the Settings UI)
// ---------------------------------------------------------------------------

export interface NumberOption {
  value: number;
  label: string;
}

/** Selectable models, sourced from the shared model registry. */
export const MODEL_OPTIONS: readonly { value: string; label: string }[] = MODEL_REGISTRY.map(
  (model) => ({ value: model.id, label: model.name }),
);

export const MAX_TOKENS_OPTIONS: readonly NumberOption[] = [
  { value: 512, label: "512" },
  { value: 1024, label: "1024" },
  { value: 2048, label: "2048" },
  { value: 4096, label: "4096" },
  { value: 8192, label: "8192" },
];

export const CONTEXT_WINDOW_OPTIONS: readonly NumberOption[] = [
  { value: 4_096, label: "4K" },
  { value: 8_192, label: "8K" },
  { value: 16_384, label: "16K" },
  { value: 32_768, label: "32K" },
  { value: 65_536, label: "64K" },
  { value: 131_072, label: "128K" },
];

/** Clamp helpers so slider / stored values stay in range. */
export const TEMPERATURE_RANGE = { min: 0, max: 1, step: 0.05 } as const;
export const TOP_P_RANGE = { min: 0, max: 1, step: 0.05 } as const;
