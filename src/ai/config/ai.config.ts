/**
 * # AI configuration
 *
 * The single place where Luna's AI behavior is tuned. Everything the
 * AI core needs to know at runtime — provider, model, sampling, the
 * system prompt — comes from an `AiConfig` object built here.
 *
 * Future settings UI will write user overrides on top of
 * `defaultAiConfig` via `createAiCore({ config: {...} })`; nothing else
 * in the codebase hardcodes these values.
 */

export interface AiConfig {
  /** Which provider serves generations (must exist in both registries). */
  providerId: string;
  /** Model id as the provider knows it (see `models/model-registry.ts`). */
  model: string;
  temperature: number;
  topP: number;
  /** Cap on generated tokens per response. */
  maxTokens: number;
  /** History budget (tokens) used to fit the prompt to the context window. */
  contextWindow: number;
  systemPrompt: string;
  /** Bump when `systemPrompt` changes meaningfully; stored per conversation. */
  systemPromptVersion: string;
  /** When false, tokens are buffered and the reply is shown all at once. */
  streaming: boolean;
  /** When false, conversations and messages are not written to the database. */
  autoSaveConversations: boolean;
}

export const defaultAiConfig: AiConfig = {
  providerId: "ollama",
  model: "qwen2.5:3b",
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2048,
  contextWindow: 32_768,
  systemPrompt:
    "You are Luna, a friendly and precise desktop AI assistant. " +
    "Answer concisely, use Markdown formatting, and use fenced code blocks with a language tag for code.",
  systemPromptVersion: "1",
  streaming: true,
  autoSaveConversations: true,
};
