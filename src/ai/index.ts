import { createLogger, setLogLevel } from "@shared/logger";

import { type AiConfig, defaultAiConfig } from "./config/ai.config";
import { SummarizingContextManager } from "./context/summarizing-context-manager";
import { SlidingWindowContextManager } from "./context/sliding-window";
import { ConversationManager } from "./conversation/conversation-manager";
import type { ConversationRepository } from "./conversation/conversation-repository";
import { IpcConversationRepository } from "./conversation/ipc-conversation-repository";
import { IpcMemoryRepository } from "./memory/ipc-memory-repository";
import { MemoryExtractor } from "./memory/memory-extractor";
import type { MemoryRepository } from "./memory/memory-repository";
import { MemoryService } from "./memory/memory-service";
import { DocumentChatService } from "./documents/document-chat.service";
import { ImageChatService } from "./documents/image-chat.service";
import { PromptBuilder } from "./prompt/prompt-builder";
import type { AIProvider } from "./provider/ai-provider";
import { createProvider } from "./provider/provider-factory";
import { type ToolSystem, createToolSystem } from "./tools";
import type { ExecutionRequest } from "./tools/types";
import { type AutomationSystem, createAutomationSystem } from "@/automation";
import { documentService } from "@/documents/document.service";
import { fileService } from "@/files/file.service";
import { permissionService } from "@/permissions/permission.service";
import { personalizationService } from "@/personalization/personalization.service";

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
  tools: ToolSystem;
  automation: AutomationSystem;
  documentChat: DocumentChatService;
  imageChat: ImageChatService;
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

  const platform =
    typeof window !== "undefined" ? (window.luna?.platform ?? "unknown") : "unknown";

  const tools = createToolSystem({ provider, model: config.model, platform });
  const automation = createAutomationSystem({
    planning: tools.service,
    platform,
    memory: memoryRepository,
  });

  const documentChat = new DocumentChatService(
    (input) => documentService.retrieve(input),
    (sourceFileId) => fileService.open(sourceFileId),
    createLogger("ai:document-chat"),
  );

  const imageChat = new ImageChatService(
    (imageId) => documentService.visionGet(imageId),
    async (imageId) => (await fileService.list()).find((file) => file.id === imageId) ?? null,
    createLogger("ai:image-chat"),
  );

  const conversation = new ConversationManager({
    provider,
    config,
    promptBuilder: new PromptBuilder(config.systemPrompt, undefined, () =>
      personalizationService.getPersonaDirective(),
    ),
    contextManager: new SummarizingContextManager({
      provider,
      getModel: () => config.model,
      fallback: new SlidingWindowContextManager(),
      // A summary calls the model. When Local AI is off, skip that call
      // and let the sliding window drop the overflow. A status read that
      // fails is treated as allowed, matching the main-process gate; the
      // gate still blocks the call itself, and a failed summary falls back.
      isLocalAiAllowed: async () => {
        try {
          return (await permissionService.status("local-ai")) === "allowed";
        } catch (error) {
          createLogger("ai:context").warn("could not read Local AI permission", {
            error: String(error),
          });
          return true;
        }
      },
    }),
    repository: conversationRepository,
    memory,
    automation: automation.service,
    documentChat,
    imageChat,
    logger: createLogger("ai:conversation"),
  });

  return {
    config,
    provider,
    conversation,
    conversationRepository,
    memory,
    memoryRepository,
    tools,
    automation,
    documentChat,
    imageChat,
  };
}

if (import.meta.env.DEV) setLogLevel("debug");

/** The application-wide AI core, built once at startup. */
export const aiCore: AiCore = createAiCore();

/**
 * Programmatic entry point. `plan` only routes; `run` executes behind
 * the permission gate. Chat calls `resolveForReply` so the assistant
 * sees each outcome before it streams. Exposed on `window` for
 * diagnostics and integration checks.
 */
export interface LunaAgentApi {
  plan: (message: string) => Promise<ExecutionRequest>;
  run: (message: string) => Promise<{ request: ExecutionRequest; results: unknown[] }>;
  listTools: () => ReturnType<AiCore["tools"]["service"]["listTools"]>;
  /** Read-only inspection hooks for diagnostics and integration tests. */
  debug: {
    cards: () => ReturnType<AiCore["automation"]["engine"]["getCards"]>;
    pending: () => ReturnType<AiCore["automation"]["permissions"]["snapshot"]>;
  };
}

declare global {
  interface Window {
    lunaAgent?: LunaAgentApi;
  }
}

if (typeof window !== "undefined") {
  window.lunaAgent = {
    plan: (message) => aiCore.tools.service.plan(message),
    run: (message) => aiCore.automation.service.run(message),
    listTools: () => aiCore.tools.service.listTools(),
    debug: {
      cards: () => aiCore.automation.engine.getCards(),
      pending: () => aiCore.automation.permissions.snapshot(),
    },
  };
}
