import type { ToolResult } from "./result";

/**
 * # Tool interface
 *
 * The contract every Luna tool implements. This milestone ships only
 * placeholder tools — `execute()` never performs real work, it returns
 * a `permission-required` result. A later milestone provides executing
 * implementations behind this same interface.
 *
 * A tool is pure metadata + three methods:
 * - `canExecute` — is this tool usable in the current environment?
 * - `validate`   — are these extracted parameters well-formed?
 * - `execute`    — run it (placeholder: returns permission-required)
 */

export type ToolCategory =
  | "application"
  | "files"
  | "productivity"
  | "system"
  | "web"
  | "documents"
  | "memory"
  | "utility";

/** Coarse capability a tool needs granted before it may run. */
export type Permission =
  | "launch-application"
  | "read-files"
  | "write-files"
  | "read-clipboard"
  | "write-clipboard"
  | "notifications"
  | "network"
  | "read-memory"
  | "write-memory";

export type ToolParameterType = "string" | "number" | "boolean" | "datetime";

export interface ToolParameterSpec {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
}

export type ToolParameters = Record<string, unknown>;

export interface ToolExecutionContext {
  platform: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Optional data-flow metadata used by the planner to chain tools:
 * a tool that `produces` a data kind can feed a later tool that
 * `accepts` it (e.g. search → open).
 */
export interface ToolDataFlow {
  /** The kind of reference this tool yields, e.g. "file-reference". */
  produces?: string;
  /** Data kinds this tool can consume from a previous step. */
  accepts?: string[];
  /** Which parameter receives an accepted upstream reference. */
  referenceParameter?: string;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly parameters: ToolParameterSpec[];
  readonly permissionsRequired: Permission[];
  readonly dataFlow: ToolDataFlow;

  /** Whether the tool is available in this environment (not permission). */
  canExecute(context: ToolExecutionContext): boolean;

  /** Validate extracted parameters before routing. */
  validate(params: ToolParameters): ValidationResult;

  /**
   * Placeholder in this milestone — always returns a permission-required
   * result and performs no action.
   */
  execute(params: ToolParameters, context: ToolExecutionContext): Promise<ToolResult>;
}
