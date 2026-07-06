import { createLogger, setLogLevel } from "@shared/logger";

import { type AiConfig, defaultAiConfig } from "./config/ai.config";
import { SlidingWindowContextManager } from "./context/sliding-window";
import { ConversationManager } from "./conversation/conversation-manager";
import { PromptBuilder } from "./prompt/prompt-builder";
import type { AIProvider } from "./provider/ai-provider";
import { createProvider } from "./provider/provider-factory";

/**
 * # AI core composition root
 *
 * The ONLY place where concrete AI implementations are chosen and
 * wired together. Everything below receives its dependencies through
 * constructors (dependency injection); nothing reaches for a global.
 *
 *     config ─┐
 *             ├─→ provider (factory) ─┐
 *             ├─→ prompt builder      ├─→ conversation manager
 *             └─→ context manager  ───┘
 *
 * - Application code uses the exported `aiCore` instance.
 * - Tests (and future features like a settings screen that changes the
 *   model at runtime) call `createAiCore` with overrides — e.g. a mock
 *   `AIProvider` — without touching any other module.
 */

export interface AiCore {
  config: AiConfig;
  provider: AIProvider;
  conversation: ConversationManager;
}

export interface AiCoreOverrides {
  config?: Partial<AiConfig>;
  /** Inject a ready-made provider (tests, future alternate providers). */
  provider?: AIProvider;
}

export function createAiCore(overrides: AiCoreOverrides = {}): AiCore {
  const config: AiConfig = { ...defaultAiConfig, ...overrides.config };
  const provider = overrides.provider ?? createProvider(config.providerId);

  const conversation = new ConversationManager({
    provider,
    config,
    promptBuilder: new PromptBuilder(config.systemPrompt),
    contextManager: new SlidingWindowContextManager(),
    logger: createLogger("ai:conversation"),
  });

  return { config, provider, conversation };
}

if (import.meta.env.DEV) setLogLevel("debug");

/** The application-wide AI core, built once at startup. */
export const aiCore: AiCore = createAiCore();
