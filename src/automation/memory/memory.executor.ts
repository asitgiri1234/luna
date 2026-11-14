import {
  type ToolParameters,
  type ToolResult,
  toolFailed,
  toolSuccess,
} from "@/ai/tools/types";
import type { MemoryRepository } from "@/ai/memory/memory-repository";
import { isMemoryCategory, type MemoryCategory } from "@shared/memory";

import type { ExecutorContext, ToolExecutor } from "../executor/types";

/**
 * # Memory executor
 *
 * Recalls or saves a personal memory. Runs only after the permission
 * gate approves, so an explicit "remember this" is the user's approval
 * to store the fact. Recall never writes.
 */
export class MemoryExecutor implements ToolExecutor {
  readonly name = "memory";

  constructor(private readonly memories: MemoryRepository) {}

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const action = String(params.action ?? "").trim().toLowerCase();
    const value = String(params.value ?? "").trim();

    try {
      if (action === "recall" || action === "search" || action === "list") {
        return await this.recall(value);
      }
      if (action === "save" || action === "remember") {
        return await this.save(params, value);
      }
      return toolFailed(this.name, `Unknown memory action "${action || "(empty)"}". Use "recall" or "save".`);
    } catch (error) {
      return toolFailed(this.name, error instanceof Error ? error.message : String(error));
    }
  }

  private async recall(value: string): Promise<ToolResult> {
    const found = value ? await this.memories.searchMemories(value) : await this.memories.listMemories();
    const active = found.filter((memory) => !memory.isArchived).slice(0, 8);
    if (active.length === 0) {
      return toolSuccess(this.name, { summary: "No matching memories.", saved: false });
    }
    const summary = active.map((memory) => `${memory.key}: ${memory.value}`).join("; ");
    return toolSuccess(this.name, {
      summary,
      saved: false,
      memories: active.map((memory) => ({ key: memory.key, value: memory.value, category: memory.category })),
    });
  }

  private async save(params: ToolParameters, value: string): Promise<ToolResult> {
    if (!value) return toolFailed(this.name, "Nothing to remember.");

    const rawCategory = String(params.category ?? "").trim().toLowerCase();
    const category: MemoryCategory = isMemoryCategory(rawCategory) ? rawCategory : "custom";
    const key = String(params.key ?? "").trim() || value.slice(0, 80);

    const result = await this.memories.saveMemory({
      category,
      key,
      value,
      confidence: 1,
      sourceConversationId: null,
    });
    const summary = result.duplicate
      ? `Updated an existing memory (“${key}”).`
      : `Remembered “${value}”.`;
    return toolSuccess(this.name, { summary, saved: true, duplicate: result.duplicate });
  }
}
