/**
 * # Shared permissions contract
 *
 * Wire types for the Privacy Dashboard, crossing IPC between the
 * renderer's permission layer (`src/permissions/`) and the main-process
 * repository/service (`electron/permissions/`). Free of imports from
 * either side except the shared `DbResult` envelope.
 *
 * A permission's descriptive metadata (name / description / why) is
 * static and lives in `PERMISSION_CATALOG`; only its status and
 * last-used timestamp are persisted. IPC handlers return `DbResult` and
 * never throw across the boundary.
 */

import type { DbResult } from "./conversations";

export type { DbResult };

// ---------------------------------------------------------------------------
// Permission identity + status
// ---------------------------------------------------------------------------

export type PermissionId =
  | "filesystem"
  | "automation"
  | "clipboard"
  | "notifications"
  | "local-ai"
  | "memory"
  | "documents";

export type PermissionStatus = "allowed" | "disabled";

/** A permission as the dashboard sees it: static metadata + live state. */
export interface PermissionRecord {
  id: PermissionId;
  name: string;
  description: string;
  /** Why Luna needs this permission (shown on "View why"). */
  reason: string;
  status: PermissionStatus;
  /** Epoch ms of the last time the capability was used, or null. */
  lastUsed: number | null;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Static catalog (descriptions live in code, not the database)
// ---------------------------------------------------------------------------

export interface PermissionDefinition {
  id: PermissionId;
  name: string;
  description: string;
  reason: string;
  defaultStatus: PermissionStatus;
}

/** All permissions Luna uses, in display order. */
export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  {
    id: "filesystem",
    name: "File System",
    description: "Search your common folders and open or reveal files you ask about.",
    reason:
      "Luna searches your Desktop, Documents, and Downloads to find files and open them on your request. It never uploads their contents.",
    defaultStatus: "allowed",
  },
  {
    id: "automation",
    name: "Desktop Automation",
    description: "Launch apps, control windows, and perform actions on your desktop.",
    reason:
      "Lets Luna act on your requests — opening an app, creating a note, setting a reminder. Every action runs behind an explicit permission prompt.",
    defaultStatus: "allowed",
  },
  {
    id: "clipboard",
    name: "Clipboard",
    description: "Read from and write to your clipboard when you ask.",
    reason:
      "Used to copy results for you or use clipboard contents you reference. Reading the clipboard is always confirmed first.",
    defaultStatus: "allowed",
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "Show desktop notifications for reminders and finished tasks.",
    reason: "Alerts you when a reminder is due or a long-running task completes.",
    defaultStatus: "allowed",
  },
  {
    id: "local-ai",
    name: "Local AI",
    description: "Run the local Ollama model to generate responses on your machine.",
    reason:
      "Powers chat and every AI feature. All inference runs locally through Ollama — nothing is sent to the cloud.",
    defaultStatus: "allowed",
  },
  {
    id: "memory",
    name: "Memory",
    description: "Remember facts you approve so Luna can personalize responses.",
    reason:
      "Stores facts you explicitly approve, locally, to ground future answers. You decide what is remembered.",
    defaultStatus: "allowed",
  },
  {
    id: "documents",
    name: "Documents",
    description: "Parse, index, and analyze uploaded documents and images locally.",
    reason:
      "Enables document chat, search, OCR, and image analysis. Everything is processed on your device.",
    defaultStatus: "allowed",
  },
] as const;

export const PERMISSION_IDS: readonly PermissionId[] = PERMISSION_CATALOG.map((p) => p.id);

export function isPermissionId(value: string): value is PermissionId {
  return (PERMISSION_IDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// IPC channels
// ---------------------------------------------------------------------------

export const PERMISSION_CHANNELS = {
  list: "permissions:list",
  grant: "permissions:grant",
  revoke: "permissions:revoke",
  status: "permissions:status",
} as const;
