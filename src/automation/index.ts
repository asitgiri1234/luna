import type { ToolPlanningService } from "@/ai/tools";
import { createLogger } from "@shared/logger";

import { LaunchApplicationExecutor } from "./applications/launch-application.executor";
import { AutomationService } from "./automation.service";
import { BrowserExecutor } from "./browser/browser.executor";
import { CalculatorExecutor } from "./calculator/calculator.executor";
import { ClipboardExecutor } from "./clipboard/clipboard.executor";
import { ExecutionEngine } from "./executor/execution-engine";
import { ExecutorRegistry } from "./executor/executor-registry";
import type { ExecutorContext, ToolExecutor } from "./executor/types";
import { DocumentExecutor, SearchFilesExecutor } from "./filesystem/search-files.executor";
import { NotesExecutor } from "./notes/notes.executor";
import { PermissionManager } from "./permission/permission-manager";
import { ReminderExecutor } from "./reminders/reminder.executor";

/**
 * # Automation composition root
 *
 * Assembles the Desktop Automation Engine: registers every executor,
 * builds the permission manager and execution engine, and exposes the
 * `AutomationService` façade plus the pieces the UI subscribes to.
 *
 *   ToolPlanningService (M6) ─┐
 *                             ├─ AutomationService.run()
 *   ExecutorRegistry ─ ExecutionEngine ─ PermissionManager
 *
 * ## Adding a tool
 * Register its `ToolExecutor` in `createExecutorRegistry()` (its `Tool`
 * definition + planning are added in the M6 registry). No existing code
 * changes.
 */

export interface AutomationSystem {
  service: AutomationService;
  engine: ExecutionEngine;
  permissions: PermissionManager;
}

export interface AutomationOptions {
  planning: ToolPlanningService;
  platform: string;
}

function createExecutorRegistry(): ExecutorRegistry {
  const registry = new ExecutorRegistry();
  const executors: ToolExecutor[] = [
    new LaunchApplicationExecutor(),
    new SearchFilesExecutor(),
    new DocumentExecutor(),
    new NotesExecutor(),
    new ClipboardExecutor(),
    new CalculatorExecutor(),
    new BrowserExecutor(),
    new ReminderExecutor(),
  ];
  for (const executor of executors) registry.register(executor);
  return registry;
}

export function createAutomationSystem(options: AutomationOptions): AutomationSystem {
  const context: ExecutorContext = { platform: options.platform };
  const registry = createExecutorRegistry();
  const permissions = new PermissionManager(createLogger("automation:permission"));
  const engine = new ExecutionEngine(
    registry,
    permissions,
    createLogger("automation:engine"),
    context,
  );
  const service = new AutomationService(
    options.planning,
    engine,
    createLogger("automation"),
  );
  return { service, engine, permissions };
}

export { AutomationService } from "./automation.service";
export type { ExecutionEngine } from "./executor/execution-engine";
export type { PermissionManager } from "./permission/permission-manager";
