import { type ToolParameters, type ToolResult, toolFailed, toolSuccess } from "@/ai/tools/types";

import type { ExecutorContext, ToolExecutor } from "../executor/types";
import { evaluateExpression, formatResult } from "./safe-eval";

/**
 * # Calculator executor
 *
 * Evaluates a math expression locally and safely (see `safe-eval.ts` —
 * no `eval`/`Function`). Needs no OS access and no permission, so it
 * runs entirely in the renderer.
 */
export class CalculatorExecutor implements ToolExecutor {
  readonly name = "calculator";

  async execute(params: ToolParameters, _context: ExecutorContext): Promise<ToolResult> {
    const expression = String(params.expression ?? "").trim();
    try {
      const value = evaluateExpression(expression);
      const formatted = formatResult(value);
      return toolSuccess(this.name, {
        value,
        formatted,
        summary: `${expression} = ${formatted}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not evaluate.";
      return toolFailed(this.name, message);
    }
  }
}
