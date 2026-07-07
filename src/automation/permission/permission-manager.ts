import type { PermissionRequest } from "@/ai/tools/types";
import type { Logger } from "@shared/logger";

import type { PendingPermission, PermissionDecision } from "../executor/types";

/**
 * # Permission manager
 *
 * The gate every executable action passes through. For each
 * `PermissionRequest` it either auto-resolves from a remembered choice
 * or raises a pending prompt and awaits the user's decision (approve /
 * deny / cancel). Nothing executes until this resolves "approved".
 *
 * Remembered choices ("remember my choice") persist in `localStorage`
 * keyed by tool name, so they survive restarts. Denials can be
 * remembered too, auto-rejecting future requests for that tool.
 */

const STORAGE_KEY = "luna.permission.policies";

type Policy = "allow" | "deny";
type PendingListener = (pending: PendingPermission[]) => void;

export class PermissionManager {
  private readonly pending = new Map<string, PendingPermission>();
  private readonly resolvers = new Map<string, (decision: PermissionDecision) => void>();
  private readonly listeners = new Set<PendingListener>();
  private policies: Record<string, Policy> = loadPolicies();

  constructor(private readonly logger: Logger) {}

  onPendingChange(listener: PendingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Current pending prompts (diagnostics / tests). */
  snapshot(): PendingPermission[] {
    return [...this.pending.values()];
  }

  private emit(): void {
    const snapshot = [...this.pending.values()];
    for (const listener of this.listeners) listener(snapshot);
  }

  /**
   * Requests approval for one action. Resolves with the decision; the
   * caller executes only when `state === "approved"`.
   */
  request(request: PermissionRequest): Promise<PermissionDecision> {
    const remembered = this.policies[request.toolName];
    if (remembered === "allow") {
      this.logger.info("permission auto-approved (remembered)", { tool: request.toolName });
      return Promise.resolve({ state: "approved", remember: true });
    }
    if (remembered === "deny") {
      this.logger.info("permission auto-denied (remembered)", { tool: request.toolName });
      return Promise.resolve({ state: "denied", remember: true });
    }

    this.pending.set(request.id, { id: request.id, request });
    this.emit();
    this.logger.info("permission requested", { tool: request.toolName, id: request.id });

    return new Promise<PermissionDecision>((resolve) => {
      this.resolvers.set(request.id, resolve);
    });
  }

  /** Called by the UI (or tests) to settle a pending request. */
  resolve(id: string, decision: PermissionDecision): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    if (decision.remember && (decision.state === "approved" || decision.state === "denied")) {
      this.policies[entry.request.toolName] = decision.state === "approved" ? "allow" : "deny";
      savePolicies(this.policies);
    }

    this.pending.delete(id);
    this.emit();
    this.resolvers.get(id)?.(decision);
    this.resolvers.delete(id);
    this.logger.info("permission resolved", { id, state: decision.state });
  }

  /** Clears all remembered choices (for a future settings screen). */
  clearRemembered(): void {
    this.policies = {};
    savePolicies(this.policies);
  }
}

function loadPolicies(): Record<string, Policy> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Policy>) : {};
  } catch {
    return {};
  }
}

function savePolicies(policies: Record<string, Policy>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(policies));
  } catch {
    // storage unavailable — remembering just won't persist
  }
}
