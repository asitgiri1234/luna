import type { Permission } from "@/ai/tools/types";
import type { ExecutionStatus } from "@/automation/executor/types";

/**
 * Presentation helpers for automation UI — friendly labels for tools,
 * statuses, and permissions. Pure UI; kept out of the executor layer.
 */

const TOOL_LABELS: Record<string, { name: string; running: string }> = {
  launch_application: { name: "Application", running: "Launching" },
  search_files: { name: "File search", running: "Searching" },
  document: { name: "Document", running: "Opening" },
  notes: { name: "Note", running: "Saving" },
  clipboard: { name: "Clipboard", running: "Working on clipboard" },
  calculator: { name: "Calculator", running: "Calculating" },
  browser: { name: "Browser", running: "Opening" },
  reminder: { name: "Reminder", running: "Creating reminder" },
  memory: { name: "Memory", running: "Recalling" },
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name]?.name ?? name;
}

export function toolRunningLabel(name: string): string {
  return TOOL_LABELS[name]?.running ?? "Working";
}

const PERMISSION_LABELS: Record<Permission, string> = {
  "launch-application": "Launch applications",
  "read-files": "Read your files",
  "write-files": "Create files",
  "read-clipboard": "Read the clipboard",
  "write-clipboard": "Write to the clipboard",
  notifications: "Show notifications",
  network: "Open web links",
  "read-memory": "Read your memories",
  "write-memory": "Save memories",
};

export function permissionLabel(permission: Permission): string {
  return PERMISSION_LABELS[permission] ?? permission;
}

export function statusTone(status: ExecutionStatus): "pending" | "active" | "good" | "bad" {
  switch (status) {
    case "success":
      return "good";
    case "failed":
    case "denied":
    case "cancelled":
      return "bad";
    case "running":
    case "awaiting-permission":
      return "active";
    default:
      return "pending";
  }
}
