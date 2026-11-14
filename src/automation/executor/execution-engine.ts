import type { ExecutionRequest, RoutedStep, ToolParameters, ToolResult } from "@/ai/tools/types";
import { toolFailed } from "@/ai/tools/types";
import type { Logger } from "@shared/logger";

import type { PermissionManager } from "../permission/permission-manager";
import type { ExecutorRegistry } from "./executor-registry";
import type { ExecutionCard, ExecutionStatus, ExecutorContext } from "./types";

/**
 * # Execution engine
 *
 * The generic executor at the center of the milestone. Given an
 * `ExecutionRequest` produced by the Milestone 6 Tool Router, it, per
 * step:
 *   1. checks the router's validation
 *   2. resolves upstream data (plan bindings: search → open)
 *   3. requests permission (never executes without approval)
 *   4. runs the tool executor and records the `ToolResult`
 *   5. emits an execution card + logs tool, args, timing, outcome
 *
 * It never plans or routes — it only executes what the router produced,
 * so the Tool Framework is never bypassed.
 */

interface EngineResult {
  requestId: string;
  results: ToolResult[];
  cards: ExecutionCard[];
}

type CardListener = (cards: ExecutionCard[]) => void;

/** Shape executors may return to feed downstream steps / card details. */
interface ResultData {
  reference?: string;
  summary?: string;
}

export class ExecutionEngine {
  private cards: ExecutionCard[] = [];
  private readonly listeners = new Set<CardListener>();

  constructor(
    private readonly executors: ExecutorRegistry,
    private readonly permissions: PermissionManager,
    private readonly logger: Logger,
    private readonly context: ExecutorContext,
  ) {}

  onCards(listener: CardListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private pushCard(card: ExecutionCard): void {
    this.cards = [...this.cards, card];
    this.emit();
  }

  private updateCard(id: string, patch: Partial<ExecutionCard>): void {
    this.cards = this.cards.map((card) => (card.id === id ? { ...card, ...patch } : card));
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.cards);
  }

  clearCards(): void {
    this.cards = [];
    this.emit();
  }

  /** Current card snapshot (diagnostics / tests). */
  getCards(): ExecutionCard[] {
    return this.cards;
  }

  /** Dismisses a permission dialog that is blocking the current run. */
  cancel(): void {
    this.permissions.cancelAll();
  }

  /**
   * Executes a routed request end to end.
   * `isCancelled` is checked between steps and after a permission
   * decision so Stop can abandon the rest of the plan.
   */
  async run(
    request: ExecutionRequest,
    isCancelled: () => boolean = () => false,
  ): Promise<EngineResult> {
    if (!request.requiresTools || !request.plan) {
      return { requestId: request.id, results: [], cards: [] };
    }

    const results = new Map<string, ToolResult>();
    const produced: EngineResult["results"] = [];
    const cardIds = new Map<string, string>();

    for (const routed of request.routedSteps) {
      const cardId = crypto.randomUUID();
      cardIds.set(routed.step.id, cardId);
      this.pushCard({
        id: cardId,
        toolName: routed.toolName,
        title: routed.toolName,
        status: "planned",
        startedAt: Date.now(),
      });
    }

    for (const routed of request.routedSteps) {
      const cardId = cardIds.get(routed.step.id)!;
      const result = isCancelled()
        ? this.skipCancelled(routed.toolName, cardId)
        : await this.runStep(routed, results, cardId, isCancelled);
      results.set(routed.step.id, result);
      produced.push(result);
    }

    return { requestId: request.id, results: produced, cards: this.cards };
  }

  private skipCancelled(toolName: string, cardId: string): ToolResult {
    this.updateCard(cardId, {
      status: "cancelled",
      detail: "Stopped before this action ran.",
      finishedAt: Date.now(),
    });
    return {
      status: "cancelled",
      toolName,
      error: "The user stopped the turn before this action ran.",
    };
  }

  private async runStep(
    routed: RoutedStep,
    results: Map<string, ToolResult>,
    cardId: string,
    isCancelled: () => boolean,
  ): Promise<ToolResult> {
    const { step, toolName, validation, permissionRequest } = routed;
    const startedAt = Date.now();
    const finish = (status: ExecutionStatus, detail?: string): void =>
      this.updateCard(cardId, { status, detail, finishedAt: Date.now() });

    if (!validation.valid) {
      finish("failed", validation.errors.join(" "));
      return toolFailed(toolName, validation.errors.join(" "));
    }

    const executor = this.executors.get(toolName);
    if (!executor) {
      finish("failed", `No executor registered for "${toolName}".`);
      return toolFailed(toolName, `No executor registered for "${toolName}".`);
    }

    // Resolve upstream data (plan bindings) into concrete parameters.
    const params: ToolParameters = { ...step.parameters };
    for (const binding of step.bindings) {
      const upstream = results.get(binding.fromStepId);
      const reference = (upstream?.data as ResultData | undefined)?.reference;
      if (upstream?.status !== "success" || !reference) {
        finish("failed", "A previous step it depends on did not complete.");
        return toolFailed(toolName, "Unmet dependency.");
      }
      params[binding.parameter] = reference;
    }

    // Permission gate — nothing runs without it.
    if (permissionRequest) {
      this.updateCard(cardId, { status: "awaiting-permission" });
      const decision = await this.permissions.request(permissionRequest);
      if (isCancelled() || decision.state !== "approved") {
        const stopped = isCancelled() || decision.state === "cancelled";
        const status = stopped ? "cancelled" : "denied";
        const error = isCancelled()
          ? "The user stopped the turn before this action ran."
          : decision.state === "denied"
            ? "The user denied permission."
            : "The user cancelled the action.";
        finish(status, error);
        this.logger.info("step not permitted", { tool: toolName, state: decision.state });
        return { status: "cancelled", toolName, error };
      }
    }

    this.updateCard(cardId, { status: "running" });
    this.logger.info("executing tool", { tool: toolName, params });
    try {
      const result = await executor.execute(params, this.context);
      const summary = (result.data as ResultData | undefined)?.summary;
      const detail = summary ?? result.error;
      finish(result.status === "success" ? "success" : "failed", detail);
      this.logger.info("tool finished", {
        tool: toolName,
        status: result.status,
        ms: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finish("failed", message);
      this.logger.warn("tool threw", { tool: toolName, error: message });
      return toolFailed(toolName, message);
    }
  }
}
