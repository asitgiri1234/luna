import { createLogger, setLogLevel } from "@shared/logger";

import { type AiConfig, defaultAiConfig } from "./config/ai.config";
import { SlidingWindowContextManager } from "./context/sliding-window";
import { ConversationManager } from "./conversation/conversation-manager";
import type { ConversationRepository } from "./conversation/conversation-repository";
import { IpcConversationRepository } from "./conversation/ipc-conversation-repository";
import { IpcMemoryRepository } from "./memory/ipc-memory-repository";
import { MemoryExtractor } from "./memory/memory-extractor";
import type { MemoryRepository } from "./memory/memory-repository";
import { MemoryService } from "./memory/memory-service";
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
  conversationRepository: ConversationRepository;
  memory: MemoryService;
  memoryRepository: MemoryRepository;
}

export interface AiCoreOverrides {
  config?: Partial<AiConfig>;
  /** Inject a ready-made provider (tests, future alternate providers). */
  provider?: AIProvider;
  /** Inject a repository (tests use an in-memory one). */
  conversationRepository?: ConversationRepository;
  memoryRepository?: MemoryRepository;
}

export function createAiCore(overrides: AiCoreOverrides = {}): AiCore {
  const config: AiConfig = { ...defaultAiConfig, ...overrides.config };
  const provider = overrides.provider ?? createProvider(config.providerId);
  const conversationRepository =
    overrides.conversationRepository ??
    new IpcConversationRepository(window.luna?.conversations);
  const memoryRepository =
    overrides.memoryRepository ?? new IpcMemoryRepository(window.luna?.memory);

  const memory = new MemoryService(
    memoryRepository,
    new MemoryExtractor(provider, config.model, createLogger("ai:memory:extractor")),
    createLogger("ai:memory"),
  );

  const conversation = new ConversationManager({
    provider,
    config,
    promptBuilder: new PromptBuilder(config.systemPrompt),
    contextManager: new SlidingWindowContextManager(),
    repository: conversationRepository,
    memory,
    logger: createLogger("ai:conversation"),
  });

  return { config, provider, conversation, conversationRepository, memory, memoryRepository };
}

if (import.meta.env.DEV) setLogLevel("debug");

/** The application-wide AI core, built once at startup. */
export const aiCore: AiCore = createAiCore();
