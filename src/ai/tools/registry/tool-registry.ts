import type { Tool, ToolCategory } from "@/ai/tools/types";

import { createDefaultTools } from "./definitions";

/**
 * # Tool registry
 *
 * The catalog of tools Luna knows about, keyed by name. The planner and
 * router resolve tools through this registry only — they never import a
 * concrete tool. Built to scale to dozens of tools: registration is one
 * call, lookup is O(1).
 *
 * ## Extension point
 * `register()` accepts any `Tool`, so future tools (including
 * dynamically discovered or plugin tools) join without touching the
 * planner or router.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  byCategory(category: ToolCategory): Tool[] {
    return this.list().filter((tool) => tool.category === category);
  }
}

/** The registry Luna ships with, pre-populated with placeholder tools. */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of createDefaultTools()) registry.register(tool);
  return registry;
}
