import type {
  Permission,
  ToolCategory,
  ToolDataFlow,
  ToolParameterSpec,
} from "@/ai/tools/types";

import { PlaceholderTool } from "./placeholder-tool";

/**
 * # Placeholder tool definitions
 *
 * The initial catalog. Every tool here is metadata-only: it describes
 * what it would do, which parameters it takes, and which permissions it
 * needs — but never executes. This is what lets the planner and router
 * reason about tools before any of them can run.
 *
 * To add a tool: create a class like these and add it to
 * `createDefaultTools()` (or register it at runtime via the registry).
 */

export class LaunchApplicationTool extends PlaceholderTool {
  readonly name = "launch_application";
  readonly description = "Open or launch a desktop application by name (e.g. Spotify, VS Code).";
  readonly category: ToolCategory = "application";
  readonly parameters: ToolParameterSpec[] = [
    { name: "application", type: "string", description: "The application to open.", required: true },
  ];
  readonly permissionsRequired: Permission[] = ["launch-application"];
}

export class SearchFilesTool extends PlaceholderTool {
  readonly name = "search_files";
  readonly description = "Find files on this computer by name, type, or content.";
  readonly category: ToolCategory = "files";
  readonly parameters: ToolParameterSpec[] = [
    { name: "query", type: "string", description: "What to search for.", required: true },
    { name: "fileType", type: "string", description: "Optional file extension filter.", required: false },
  ];
  readonly permissionsRequired: Permission[] = ["read-files"];
  readonly dataFlow: ToolDataFlow = { produces: "file-reference" };
}

export class ReminderTool extends PlaceholderTool {
  readonly name = "reminder";
  readonly description = "Create a reminder or alarm for a specific time.";
  readonly category: ToolCategory = "productivity";
  readonly parameters: ToolParameterSpec[] = [
    { name: "title", type: "string", description: "What to be reminded about.", required: true },
    { name: "time", type: "datetime", description: "When to remind (natural language ok).", required: true },
  ];
  readonly permissionsRequired: Permission[] = ["notifications"];
}

export class NotesTool extends PlaceholderTool {
  readonly name = "notes";
  readonly description = "Create or append a note.";
  readonly category: ToolCategory = "productivity";
  readonly parameters: ToolParameterSpec[] = [
    { name: "content", type: "string", description: "The note body.", required: true },
    { name: "title", type: "string", description: "Optional note title.", required: false },
  ];
  readonly permissionsRequired: Permission[] = ["write-files"];
}

export class ClipboardTool extends PlaceholderTool {
  readonly name = "clipboard";
  readonly description = "Read from or write to the system clipboard.";
  readonly category: ToolCategory = "system";
  readonly parameters: ToolParameterSpec[] = [
    { name: "action", type: "string", description: '"read" or "write".', required: true },
    { name: "content", type: "string", description: "Text to write (for write).", required: false },
  ];
  readonly permissionsRequired: Permission[] = ["read-clipboard", "write-clipboard"];
}

export class CalculatorTool extends PlaceholderTool {
  readonly name = "calculator";
  readonly description = "Evaluate a mathematical expression.";
  readonly category: ToolCategory = "utility";
  readonly parameters: ToolParameterSpec[] = [
    { name: "expression", type: "string", description: "The expression to evaluate.", required: true },
  ];
  // Pure computation — needs no permission. Still not auto-executed here.
  readonly permissionsRequired: Permission[] = [];
}

export class BrowserTool extends PlaceholderTool {
  readonly name = "browser";
  readonly description = "Open a URL or run a web search in the default browser.";
  readonly category: ToolCategory = "web";
  readonly parameters: ToolParameterSpec[] = [
    { name: "url", type: "string", description: "A URL to open.", required: false },
    { name: "query", type: "string", description: "A search query.", required: false },
  ];
  readonly permissionsRequired: Permission[] = ["network"];
}

export class DocumentTool extends PlaceholderTool {
  readonly name = "document";
  readonly description = "Open or read a document file (PDF, Word, text).";
  readonly category: ToolCategory = "documents";
  readonly parameters: ToolParameterSpec[] = [
    { name: "path", type: "string", description: "Path to the document.", required: true },
  ];
  readonly permissionsRequired: Permission[] = ["read-files"];
  // Can consume a file found by a previous search step.
  readonly dataFlow: ToolDataFlow = { accepts: ["file-reference"], referenceParameter: "path" };
}

export class MemoryTool extends PlaceholderTool {
  readonly name = "memory";
  readonly description = "Recall or save a personal memory about the user.";
  readonly category: ToolCategory = "memory";
  readonly parameters: ToolParameterSpec[] = [
    { name: "action", type: "string", description: '"recall" or "save".', required: true },
    { name: "value", type: "string", description: "What to recall or save.", required: true },
  ];
  readonly permissionsRequired: Permission[] = ["read-memory", "write-memory"];
}

/** The tools Luna registers at startup. */
export function createDefaultTools(): PlaceholderTool[] {
  return [
    new LaunchApplicationTool(),
    new SearchFilesTool(),
    new ReminderTool(),
    new NotesTool(),
    new ClipboardTool(),
    new CalculatorTool(),
    new BrowserTool(),
    new DocumentTool(),
    new MemoryTool(),
  ];
}
