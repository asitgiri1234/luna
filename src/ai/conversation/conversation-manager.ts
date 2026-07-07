import type { AiConfig } from "@/ai/config/ai.config";
import type { ContextManager } from "@/ai/context/context-manager";
import { resolveModel } from "@/ai/models/model-registry";
import type { PromptBuilder } from "@/ai/prompt/prompt-builder";
import type { AIProvider } from "@/ai/provider/ai-provider";
import type {
  AiChatMessage,
  ConversationMessage,
  ConversationState,
  GenerationHandle,
} from "@/ai/types";
import type { ConversationMemoryPort } from "@/ai/memory/memory-service";
import type { ConversationAutomationPort } from "@/automation/automation.service";
import type { ConversationMeta } from "@shared/conversations";
import { PersistenceError } from "@shared/conversations";
import type { Logger } from "@shared/logger";

import type { ConversationRepository } from "./conversation-repository";

/**
 * # Conversation manager
 *
 * The state machine of the active conversation, independent of React
 * and of any state library:
 *
 *     idle → waiting → streaming → idle
 *                  ↘  stopping  ↗
 *
 * Responsibilities:
 * - `send` / `stop` / `regenerate` / `reset` commands
 * - building the outgoing prompt via the injected `PromptBuilder` and
 *   fitting it via the injected `ContextManager`
 * - consuming the provider stream with frame-aligned token batching
 * - **persistence**: lazily creates a conversation row on the first
 *   send, saves every user/assistant message (including interrupted
 *   partials), auto-titles after the first completed exchange, and
 *   hydrates history when a saved conversation is selected
 * - conversation-list operations (list/rename/pin/delete) for the
 *   conversation store — always through the injected repository
 *
 * Persistence is deliberately non-fatal: every write goes through a
 * serialized queue (creation must land before messages), and if the
 * database is unavailable the manager logs, flags it, and chat keeps
 * working in-memory.
 *
 * ## Extension points
 * - **Memory**: pass retrieved facts into `promptBuilder.build`; mine
 *   past conversations through the same repository.
 * - **Multiple live threads**: instantiate one manager per thread.
 */

const DEFAULT_TITLE = "New chat";
const PREVIEW_LENGTH = 80;

export interface ConversationDeps {
  provider: AIProvider;
  config: AiConfig;
  promptBuilder: PromptBuilder;
  contextManager: ContextManager;
  repository: ConversationRepository;
  memory: ConversationMemoryPort;
  /** Optional: lets a user message trigger permission-gated tool execution. */
  automation?: ConversationAutomationPort;
  logger: Logger;
}

type StateListener = (state: ConversationState) => void;

function toPreview(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH);
}

export class ConversationManager {
  private state: ConversationState = { messages: [], status: "idle", error: null };
  private readonly stateListeners = new Set<StateListener>();
  private readonly conversationListeners = new Set<() => void>();

  private handle: GenerationHandle | null = null;
  private tokenBuffer = "";
  private flushScheduled = false;

  private activeConversationId: string | null = null;
  /** Conversation still waiting for its auto-generated title. */
  private titlePendingFor: string | null = null;
  /** Serializes writes so create → user msg → assistant msg land in order. */
  private persistQueue: Promise<void> = Promise.resolve();
  private persistenceOk = true;
  /** Invalidates in-flight stream callbacks when the thread switches. */
  private epoch = 0;
  /** User text to mine for memories once the current exchange completes. */
  private pendingExtractionText: string | null = null;

  constructor(private readonly deps: ConversationDeps) {}

  // -- Subscription ---------------------------------------------------------

  getState(): ConversationState {
    return this.state;
  }

  getActiveConversationId(): string | null {
    return this.activeConversationId;
  }

  /** True until a repository call fails with an unavailable database. */
  isPersistenceAvailable(): boolean {
    return this.persistenceOk;
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** Fires after anything that changes the saved conversation list. */
  onConversationsChanged(listener: () => void): () => void {
    this.conversationListeners.add(listener);
    return () => this.conversationListeners.delete(listener);
  }

  private setState(patch: Partial<ConversationState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.stateListeners) listener(this.state);
  }

  private emitConversationsChanged(): void {
    for (const listener of this.conversationListeners) listener();
  }

  // -- Chat commands --------------------------------------------------------

  send(content: string): void {
    const text = content.trim();
    if (!text || this.state.status !== "idle") return;

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    this.setState({ error: null, messages: [...this.state.messages, userMessage] });
    // Mine this message for memories once the exchange finishes.
    this.pendingExtractionText = userMessage.content;

    this.enqueuePersist(async () => {
      const conversationId = await this.ensureConversation();
      await this.deps.repository.saveMessage({
        id: userMessage.id,
        conversationId,
        role: "user",
        content: userMessage.content,
        createdAt: userMessage.createdAt,
        tokenCount: this.deps.contextManager.estimateTokens(userMessage.content),
        preview: toPreview(userMessage.content),
      });
      this.emitConversationsChanged();
    });

    this.startGeneration();
  }

  stop(): void {
    if (this.state.status !== "waiting" && this.state.status !== "streaming") return;
    this.setState({ status: "stopping" });
    this.handle?.cancel();
  }

  /** Re-runs the last exchange (drops the trailing assistant reply, if any). */
  regenerate(): void {
    if (this.state.status !== "idle") return;
    const messages = [...this.state.messages];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      messages.pop();
      this.enqueuePersist(() => this.deps.repository.deleteMessage(last.id));
    }
    if (messages[messages.length - 1]?.role !== "user") return;
    this.setState({ messages, error: null });
    this.startGeneration();
  }

  /** Clears the active thread. The next send starts a new conversation. */
  reset(): void {
    this.epoch += 1;
    this.handle?.cancel();
    this.handle = null;
    this.tokenBuffer = "";
    this.activeConversationId = null;
    this.titlePendingFor = null;
    this.setState({ messages: [], status: "idle", error: null });
  }

  dismissError(): void {
    this.setState({ error: null });
  }

  // -- Conversation-list operations (used by the conversation store) --------

  listConversations(): Promise<ConversationMeta[]> {
    return this.deps.repository.list();
  }

  /** Loads a saved conversation and makes it the active thread. */
  async selectConversation(id: string): Promise<void> {
    this.epoch += 1;
    this.handle?.cancel();
    this.handle = null;
    this.tokenBuffer = "";

    const stored = await this.deps.repository.loadMessages(id);
    const messages: ConversationMessage[] = stored
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        id: message.id,
        role: message.role as "user" | "assistant",
        content: message.content,
        createdAt: message.createdAt,
        interrupted: message.metadata?.interrupted === true || undefined,
      }));

    this.activeConversationId = id;
    this.titlePendingFor = null;
    this.setState({ messages, status: "idle", error: null });
  }

  async deleteConversation(id: string): Promise<void> {
    if (id === this.activeConversationId) this.reset();
    await this.deps.repository.remove(id);
    this.emitConversationsChanged();
  }

  async renameConversation(id: string, title: string): Promise<void> {
    const clean = title.trim();
    if (!clean) return;
    await this.deps.repository.rename(id, clean);
    this.emitConversationsChanged();
  }

  async pinConversation(id: string, isPinned: boolean): Promise<void> {
    await this.deps.repository.setPinned(id, isPinned);
    this.emitConversationsChanged();
  }

  // -- Persistence plumbing -------------------------------------------------

  /** Returns the active conversation id, creating the row on first use. */
  private async ensureConversation(): Promise<string> {
    if (this.activeConversationId) return this.activeConversationId;
    const meta = await this.deps.repository.create({
      title: DEFAULT_TITLE,
      modelUsed: this.deps.config.model,
      systemPromptVersion: this.deps.config.systemPromptVersion,
    });
    this.activeConversationId = meta.id;
    this.titlePendingFor = meta.id;
    this.deps.logger.info("conversation created", { conversationId: meta.id });
    return meta.id;
  }

  /**
   * Serialized, non-fatal persistence. Order is guaranteed; failures
   * are logged and (for database-level failures) flip the availability
   * flag, but never interrupt the chat.
   */
  private enqueuePersist(operation: () => Promise<void>): void {
    this.persistQueue = this.persistQueue.then(async () => {
      if (!this.persistenceOk) return;
      try {
        await operation();
      } catch (error) {
        if (
          error instanceof PersistenceError &&
          (error.code === "db-unavailable" || error.code === "migration-failed")
        ) {
          this.persistenceOk = false;
          this.emitConversationsChanged();
        }
        this.deps.logger.warn("persistence operation failed", { error: String(error) });
      }
    });
  }

  private persistAssistantMessage(message: ConversationMessage): void {
    this.enqueuePersist(async () => {
      const conversationId = this.activeConversationId;
      if (!conversationId) return;
      await this.deps.repository.saveMessage({
        id: message.id,
        conversationId,
        role: "assistant",
        content: message.content,
        createdAt: message.createdAt,
        tokenCount: this.deps.contextManager.estimateTokens(message.content),
        metadata: message.interrupted ? { interrupted: true } : null,
        preview: toPreview(message.content),
      });
      this.emitConversationsChanged();
    });
    this.maybeGenerateTitle();
  }

  /**
   * Mines the just-completed user message for memory candidates. Runs
   * after generation so it never competes with streaming for the model.
   */
  private runPendingExtraction(): void {
    const text = this.pendingExtractionText;
    this.pendingExtractionText = null;
    if (!text) return;
    this.deps.memory.observeUserMessage(text, this.activeConversationId);
    // A user message may also imply a tool action; the automation service
    // pre-filters and, if warranted, plans + executes behind the permission
    // gate. Fire-and-forget so it never blocks chat.
    this.deps.automation?.observeUserMessage(text);
  }

  // -- Auto title -----------------------------------------------------------

  /** After the first completed exchange, ask the model for a 3–5 word title. */
  private maybeGenerateTitle(): void {
    const conversationId = this.titlePendingFor;
    if (!conversationId || conversationId !== this.activeConversationId) return;

    const userText = this.state.messages.find((m) => m.role === "user")?.content;
    const assistantText = this.state.messages.find((m) => m.role === "assistant")?.content;
    if (!userText || !assistantText) return;
    this.titlePendingFor = null;

    void this.deps.provider
      .generate({
        model: this.deps.config.model,
        messages: [
          {
            role: "system",
            content:
              "You create very short titles for chat conversations. " +
              "Reply with ONLY the title: 3 to 5 plain words, no punctuation, no quotes.",
          },
          {
            role: "user",
            content: `Create a title for this conversation.\n\nUser: ${userText.slice(0, 400)}\n\nAssistant: ${assistantText.slice(0, 400)}`,
          },
        ],
        options: { temperature: 0.2, maxTokens: 24 },
      })
      .then((raw) => {
        const title = sanitizeTitle(raw) || fallbackTitle(userText);
        this.enqueuePersist(async () => {
          await this.deps.repository.rename(conversationId, title);
          this.emitConversationsChanged();
        });
      })
      .catch((error) => {
        // Title generation is best-effort; fall back to the user's words.
        this.deps.logger.warn("auto-title failed", { error: String(error) });
        const title = fallbackTitle(userText);
        this.enqueuePersist(async () => {
          await this.deps.repository.rename(conversationId, title);
          this.emitConversationsChanged();
        });
      });
  }

  // -- Generation -----------------------------------------------------------

  /**
   * Shows the pending assistant bubble immediately, then (asynchronously)
   * retrieves relevant memories and starts streaming. Retrieval happens
   * behind the typing indicator so the UI never stalls.
   */
  private startGeneration(): void {
    const epoch = this.epoch;
    const query = [...this.state.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    this.setState({
      status: "waiting",
      error: null,
      messages: [
        ...this.state.messages,
        { id: crypto.randomUUID(), role: "assistant", content: "", createdAt: Date.now() },
      ],
    });

    void this.beginStream(epoch, query);
  }

  private async beginStream(epoch: number, query: string): Promise<void> {
    const { provider, config, promptBuilder, contextManager, logger } = this.deps;

    // Retrieve only memories relevant to this turn, and inject them.
    const memory = await this.deps.memory.getRelevantMemories(query);
    if (epoch !== this.epoch) return; // thread switched while retrieving
    if (memory.length > 0) logger.debug("injected memories", { count: memory.length });

    const history: AiChatMessage[] = this.state.messages
      .filter((m) => m.content !== "" || m.role === "user")
      .map(({ role, content }) => ({ role, content }));
    const prompt = promptBuilder.build({ history, memory });

    const model = resolveModel(config.model);
    const fitted = contextManager.fitToWindow(prompt, {
      contextLength: model.contextLength,
      reservedForResponse: config.maxTokens,
    });

    this.handle = provider.stream(
      {
        model: config.model,
        messages: fitted,
        options: {
          temperature: config.temperature,
          topP: config.topP,
          maxTokens: config.maxTokens,
        },
      },
      {
        onToken: (token) => {
          if (epoch !== this.epoch) return;
          this.tokenBuffer += token;
          this.scheduleFlush();
        },
        onDone: ({ cancelled }) => {
          if (epoch !== this.epoch) return;
          this.flushTokens();
          this.handle = null;
          const completed = this.finishAssistantMessage((last) =>
            cancelled ? { ...last, interrupted: true } : last,
          );
          if (completed) this.persistAssistantMessage(completed);
          this.runPendingExtraction();
          logger.debug("generation done", { cancelled });
        },
        onError: (error) => {
          if (epoch !== this.epoch) return;
          this.flushTokens();
          this.handle = null;
          const partial = this.finishAssistantMessage((last) => ({
            ...last,
            interrupted: true,
          }));
          if (partial) this.persistAssistantMessage(partial);
          this.setState({ error: { code: error.code, message: error.message } });
          logger.warn("generation failed", { code: error.code, message: error.message });
        },
      },
    );
  }

  /**
   * Completes the trailing assistant message: removes it when empty
   * (nothing arrived), otherwise applies `transform`. Returns the final
   * message, or null when it was removed. Always returns to idle.
   */
  private finishAssistantMessage(
    transform: (last: ConversationMessage) => ConversationMessage,
  ): ConversationMessage | null {
    const messages = [...this.state.messages];
    const last = messages[messages.length - 1];
    let result: ConversationMessage | null = null;
    if (last?.role === "assistant") {
      if (last.content === "") {
        messages.pop();
      } else {
        result = transform(last);
        messages[messages.length - 1] = result;
      }
    }
    this.setState({ messages, status: "idle" });
    return result;
  }

  // -- Smooth streaming -----------------------------------------------------
  //
  // Tokens arrive over IPC far faster than the UI should re-render, so
  // they accumulate in `tokenBuffer` and flush at most once per
  // animation frame (with a timer fallback while the window is hidden,
  // because browsers suspend rAF for background windows).

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    if (document.visibilityState === "visible") {
      requestAnimationFrame(() => this.flushTokens());
    } else {
      setTimeout(() => this.flushTokens(), 50);
    }
  }

  private flushTokens(): void {
    this.flushScheduled = false;
    if (!this.tokenBuffer) return;
    const text = this.tokenBuffer;
    this.tokenBuffer = "";

    const messages = [...this.state.messages];
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    messages[messages.length - 1] = { ...last, content: last.content + text };
    this.setState({
      messages,
      status: this.state.status === "waiting" ? "streaming" : this.state.status,
    });
  }
}

// ---------------------------------------------------------------------------
// Title helpers
// ---------------------------------------------------------------------------

/** Enforces the title rules: plain words only, at most 5, no punctuation. */
function sanitizeTitle(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ")
    .trim();
}

/** Last resort: the first few words of the user's opening message. */
function fallbackTitle(userText: string): string {
  return sanitizeTitle(userText).split(" ").slice(0, 4).join(" ") || DEFAULT_TITLE;
}
