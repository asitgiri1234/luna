/**
 * # Shared activity contract
 *
 * Wire types for the Activity History feature, crossing IPC between the
 * renderer's activity layer (`src/activity/`, `src/store/activity/`) and
 * the main-process repository/service (`electron/activity/`). Free of
 * imports from either side except the shared `DbResult` envelope.
 *
 * Activities are an append-only audit log: important user and assistant
 * actions are recorded from the existing main-process chokepoints (the
 * persistence controllers + the automation runner). Descriptive labels
 * are static and live in `ACTIVITY_LABELS`; only the row itself is
 * persisted. IPC handlers return `DbResult` and never throw across the
 * boundary.
 */

import type { DbResult } from "./conversations";

export type { DbResult };

// ---------------------------------------------------------------------------
// Activity identity + status
// ---------------------------------------------------------------------------

export type ActivityType =
  | "conversation-started"
  | "message-sent"
  | "memory-created"
  | "memory-updated"
  | "memory-deleted"
  | "file-uploaded"
  | "document-parsed"
  | "document-chat"
  | "tool-executed"
  | "application-opened"
  | "reminder-created"
  | "clipboard-access"
  | "permission-granted"
  | "permission-revoked";

export type ActivityStatus = "success" | "failed" | "cancelled";

/** One recorded action, as the timeline sees it. */
export interface ActivityRecord {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: number;
  status: ActivityStatus;
  /** Optional structured extras (filename, id, …); never required. */
  metadata: Record<string, unknown> | null;
}

/** What a caller supplies to record an activity (id + timestamp are filled in). */
export interface LogActivityInput {
  type: ActivityType;
  description: string;
  status?: ActivityStatus;
  metadata?: Record<string, unknown> | null;
}

/** Narrowing / searching options for a listing. */
export interface ActivityQuery {
  type?: ActivityType | "all";
  search?: string;
}

// ---------------------------------------------------------------------------
// Static catalog (labels live in code, not the database)
// ---------------------------------------------------------------------------

/** Every activity type, in the order the filter presents them. */
export const ACTIVITY_TYPES: readonly ActivityType[] = [
  "conversation-started",
  "message-sent",
  "memory-created",
  "memory-updated",
  "memory-deleted",
  "file-uploaded",
  "document-parsed",
  "document-chat",
  "tool-executed",
  "application-opened",
  "reminder-created",
  "clipboard-access",
  "permission-granted",
  "permission-revoked",
] as const;

/** Human-readable label for each activity type. */
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  "conversation-started": "Conversation Started",
  "message-sent": "Message Sent",
  "memory-created": "Memory Created",
  "memory-updated": "Memory Updated",
  "memory-deleted": "Memory Deleted",
  "file-uploaded": "File Uploaded",
  "document-parsed": "Document Parsed",
  "document-chat": "Document Chat",
  "tool-executed": "Tool Executed",
  "application-opened": "Application Opened",
  "reminder-created": "Reminder Created",
  "clipboard-access": "Clipboard Access",
  "permission-granted": "Permission Granted",
  "permission-revoked": "Permission Revoked",
};

export function isActivityType(value: string): value is ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// IPC channels
// ---------------------------------------------------------------------------

export const ACTIVITY_CHANNELS = {
  list: "activity:list",
  clear: "activity:clear",
} as const;
