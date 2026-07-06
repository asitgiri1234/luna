import type {
  Permission,
  Tool,
  ToolCategory,
  ToolDataFlow,
  ToolExecutionContext,
  ToolParameters,
  ToolParameterSpec,
  ToolResult,
  ValidationResult,
} from "@/ai/tools/types";

/**
 * # Placeholder tool base
 *
 * Shared implementation for this planning-only milestone. Provides
 * generic parameter validation and a non-executing `execute()` that
 * always reports `permission-required`. Concrete tools declare their
 * metadata and (optionally) refine `validate`.
 *
 * ## Adding a real tool later
 * Subclass this (or implement `Tool` directly), keep the metadata, and
 * override `execute()` to do the work behind a granted permission. The
 * registry, planner, and router need no changes.
 */
export abstract class PlaceholderTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: ToolCategory;
  abstract readonly parameters: ToolParameterSpec[];
  abstract readonly permissionsRequired: Permission[];
  readonly dataFlow: ToolDataFlow = {};

  canExecute(_context: ToolExecutionContext): boolean {
    // Placeholder tools are "available" everywhere; real tools may gate
    // on platform or installed dependencies here.
    return true;
  }

  validate(params: ToolParameters): ValidationResult {
    const errors: string[] = [];
    for (const spec of this.parameters) {
      const value = params[spec.name];
      if (value === undefined || value === null || value === "") {
        if (spec.required) errors.push(`Missing required parameter "${spec.name}".`);
        continue;
      }
      if (!matchesType(value, spec.type)) {
        errors.push(`Parameter "${spec.name}" should be a ${spec.type}.`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  async execute(_params: ToolParameters, _context: ToolExecutionContext): Promise<ToolResult> {
    // Execution is intentionally not implemented in this milestone.
    return {
      status: "permission-required",
      toolName: this.name,
      error: "Tool execution is not implemented yet (planning-only milestone).",
    };
  }
}

function matchesType(value: unknown, type: ToolParameterSpec["type"]): boolean {
  switch (type) {
    case "string":
    case "datetime":
      return typeof value === "string";
    case "number":
      return typeof value === "number" || (typeof value === "string" && !Number.isNaN(Number(value)));
    case "boolean":
      return typeof value === "boolean";
  }
}
