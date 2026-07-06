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
import type { Logger } from "@shared/logger";

/**
 * # Conversation manager
 *
 * The state machine of one conversation, independent of React and of
 * any state library:
 *
 *     idle → waiting → streaming → idle
 *                  ↘  stopping  ↗
 *
 * Responsibilities:
 * - `send` / `stop` / `regenerate` / `reset` commands
 * - building the outgoing prompt via the injected `PromptBuilder` and
 *   fitting it via the injected `ContextManager`
 * - consuming the provider stream and batching tokens at most once per
 *   animation frame (streaming stays smooth no matter how fast the
 *   provider emits)
 * - exposing an immutable snapshot + subscribe API that any adapter
 *   (today: the zustand chat store) can mirror
 *
 * ## Extension points
 * - **Persistence**: subscribe and write snapshots to disk; hydrate by
 *   constructing with `initialMessages`.
 * - **Memory**: pass retrieved facts into `promptBuilder.build`.
 * - **Multiple conversations**: instantiate one manager per thread.
 */

export interface ConversationDeps {
  provider: AIProvider;
  config: AiConfig;
  promptBuilder: PromptBuilder;
  contextManager: ContextManager;
  logger: Logger;
}

type Listener = (state: ConversationState) => void;

export class ConversationManager {
  private state: ConversationState = { messages: [], status: "idle", error: null };
  private readonly listeners = new Set<Listener>();

  private handle: GenerationHandle | null = null;
  private tokenBuffer = "";
  private flushScheduled = false;

  constructor(private readonly deps: ConversationDeps) {}

  // -- Subscription ---------------------------------------------------------

  getState(): ConversationState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<ConversationState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  // -- Commands -------------------------------------------------------------

  send(content: string): void {
    const text = content.trim();
    if (!text || this.state.status !== "idle") return;
    this.setState({
      error: null,
      messages: [
        ...this.state.messages,
        { id: crypto.randomUUID(), role: "user", content: text, createdAt: Date.now() },
      ],
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
    if (messages[messages.length - 1]?.role === "assistant") messages.pop();
    if (messages[messages.length - 1]?.role !== "user") return;
    this.setState({ messages, error: null });
    this.startGeneration();
  }

  reset(): void {
    this.handle?.cancel();
    this.handle = null;
    this.tokenBuffer = "";
    this.setState({ messages: [], status: "idle", error: null });
  }

  dismissError(): void {
    this.setState({ error: null });
  }

  // -- Generation -----------------------------------------------------------

  /** Streams a reply to the current history (which must end with a user turn). */
  private startGeneration(): void {
    const { provider, config, promptBuilder, contextManager, logger } = this.deps;

    const history: AiChatMessage[] = this.state.messages.map(({ role, content }) => ({
      role,
      content,
    }));
    const prompt = promptBuilder.build({ history });

    const model = resolveModel(config.model);
    const fitted = contextManager.fitToWindow(prompt, {
      contextLength: model.contextLength,
      reservedForResponse: config.maxTokens,
    });

    this.setState({
      status: "waiting",
      error: null,
      messages: [
        ...this.state.messages,
        { id: crypto.randomUUID(), role: "assistant", content: "", createdAt: Date.now() },
      ],
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
          this.tokenBuffer += token;
          this.scheduleFlush();
        },
        onDone: ({ cancelled }) => {
          this.flushTokens();
          this.handle = null;
          this.finishAssistantMessage((last) =>
            cancelled ? { ...last, interrupted: true } : last,
          );
          logger.debug("generation done", { cancelled });
        },
        onError: (error) => {
          this.flushTokens();
          this.handle = null;
          this.finishAssistantMessage(null);
          this.setState({ error: { code: error.code, message: error.message } });
          logger.warn("generation failed", { code: error.code, message: error.message });
        },
      },
    );
  }

  /**
   * Completes the trailing assistant message: removes it when empty
   * (nothing arrived), otherwise applies `transform`, and returns to idle.
   */
  private finishAssistantMessage(
    transform: ((last: ConversationMessage) => ConversationMessage) | null,
  ): void {
    const messages = [...this.state.messages];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      if (last.content === "") {
        messages.pop();
      } else if (transform) {
        messages[messages.length - 1] = transform(last);
      }
    }
    this.setState({ messages, status: "idle" });
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
