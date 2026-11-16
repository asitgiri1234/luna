import type { PermissionId } from "../../shared/permissions";

/**
 * Which Privacy toggle an automation IPC operation belongs to.
 * `null` means the operation is not gated here (notifications are gated
 * inside `notify`, so the reminder timer and the IPC path share one check).
 * Listing and deleting notes and reminders is also ungated: the Notes
 * page can show and remove ones already saved when Desktop Automation
 * is off. Creating them from chat stays gated.
 */
const AUTOMATION_PERMISSIONS: Record<string, PermissionId> = {
  "apps-list": "automation",
  "app-launch": "automation",
  "open-url": "automation",
  "reminder-create": "automation",
  "note-create": "automation",
  "note-update": "automation",
  "note-open": "automation",
  "file-search": "filesystem",
  "file-open": "filesystem",
  "file-reveal": "filesystem",
  "folder-open": "filesystem",
  "clipboard-read": "clipboard",
  "clipboard-write": "clipboard",
  "clipboard-clear": "clipboard",
};

export function automationPermission(operation: string): PermissionId | null {
  return AUTOMATION_PERMISSIONS[operation] ?? null;
}
