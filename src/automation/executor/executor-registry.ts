import type { ToolExecutor } from "./types";

/**
 * # Executor registry
 *
 * Maps a tool name (the same name used by the Milestone 6 `Tool`
 * definition and the router) to the executor that performs its work.
 * The execution engine resolves executors here; it never imports one
 * directly.
 *
 * ## Extension point
 * A new tool ships a `Tool` definition (planning) and a `ToolExecutor`
 * (doing) registered here under the same name. Existing tools are
 * untouched.
 */
export class ExecutorRegistry {
  private readonly executors = new Map<string, ToolExecutor>();

  register(executor: ToolExecutor): void {
    this.executors.set(executor.name, executor);
  }

  get(name: string): ToolExecutor | undefined {
    return this.executors.get(name);
  }

  has(name: string): boolean {
    return this.executors.has(name);
  }
}
