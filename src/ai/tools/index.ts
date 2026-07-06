import type { AIProvider } from "@/ai/provider/ai-provider";
import { createLogger } from "@shared/logger";

import { IntentDetector } from "./intent/intent-detector";
import { PermissionLayer } from "./permission/permission-layer";
import { Planner } from "./planner/planner";
import { type ToolRegistry, createDefaultRegistry } from "./registry/tool-registry";
import { ToolRouter } from "./router/tool-router";
import { ToolPlanningService } from "./tool-planning.service";
import type { ToolExecutionContext } from "./types";

/**
 * # Tool framework composition root
 *
 * Wires the tool-calling pipeline together and injects dependencies.
 * The rest of the app touches only `ToolPlanningService` (via
 * `aiCore.tools`); the internal components stay private.
 *
 *   registry ─┐
 *             ├─ IntentDetector ─┐
 *   provider ─┘                  ├─ ToolPlanningService.plan()
 *             ┌─ Planner ────────┤
 *   registry ─┤                  │
 *             └─ ToolRouter ─────┘
 *                    │
 *              PermissionLayer
 */

export interface ToolSystem {
  registry: ToolRegistry;
  service: ToolPlanningService;
}

export interface ToolSystemOptions {
  provider: AIProvider;
  model: string;
  /** Inject a custom registry (tests, or a trimmed tool set). */
  registry?: ToolRegistry;
  platform?: string;
}

export function createToolSystem(options: ToolSystemOptions): ToolSystem {
  const registry = options.registry ?? createDefaultRegistry();
  const context: ToolExecutionContext = { platform: options.platform ?? "unknown" };

  const detector = new IntentDetector(
    options.provider,
    registry,
    options.model,
    createLogger("ai:tools:intent"),
  );
  const planner = new Planner(registry, createLogger("ai:tools:planner"));
  const permissions = new PermissionLayer();
  const router = new ToolRouter(registry, permissions, createLogger("ai:tools:router"));

  const service = new ToolPlanningService(
    detector,
    planner,
    router,
    registry,
    createLogger("ai:tools"),
    context,
  );

  return { registry, service };
}

export type { ToolPlanningService } from "./tool-planning.service";
export type { ToolDescriptor } from "./tool-planning.service";
