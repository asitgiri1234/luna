/**
 * # Shared automation contract
 *
 * Wire types for the Desktop Automation Engine, crossing IPC between the
 * renderer's executors (`src/automation/`) and the main-process OS layer
 * (`electron/automation/`). Free of imports from either side.
 *
 * The renderer never touches the OS directly: every executor forwards a
 * typed request here and the main process performs the actual action.
 * Handlers return `AutomationResult` envelopes (invoke rejections lose
 * error metadata across IPC).
 */

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface AppInfo {
  /** Canonical key, e.g. "chrome". */
  key: string;
  name: string;
  installed: boolean;
}

export interface LaunchAppResult {
  app: string;
  alreadyRunning: boolean;
  focused: boolean;
}

export interface FileHit {
  path: string;
  name: string;
  directory: string;
  size: number;
  modifiedAt: number;
}

export interface ClipboardReadResult {
  text: string;
}

export interface ReminderRecord {
  id: string;
  title: string;
  remindAt: number;
  createdAt: number;
  notified: boolean;
}

export interface NoteRecord {
  id: string;
  title: string;
  path: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface SearchFilesInput {
  query: string;
  /** Optional extension filter without the dot, e.g. "pdf". */
  fileType?: string;
  limit?: number;
}

export interface CreateReminderInput {
  title: string;
  remindAt: number;
}

export interface CreateNoteInput {
  title: string;
  content: string;
}

export interface UpdateNoteInput {
  id: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Errors / results
// ---------------------------------------------------------------------------

export type AutomationErrorCode =
  | "app-unknown"
  | "app-not-found"
  | "launch-failed"
  | "file-missing"
  | "clipboard-unavailable"
  | "notification-failed"
  | "not-found"
  | "invalid"
  | "unknown";

export class AutomationError extends Error {
  constructor(
    public readonly code: AutomationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AutomationError";
  }
}

export type AutomationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AutomationErrorCode; message: string };

// ---------------------------------------------------------------------------
// IPC channels
// ---------------------------------------------------------------------------

export const AUTOMATION_CHANNELS = {
  appsList: "automation:apps-list",
  appLaunch: "automation:app-launch",
  fileSearch: "automation:file-search",
  fileOpen: "automation:file-open",
  fileReveal: "automation:file-reveal",
  folderOpen: "automation:folder-open",
  clipboardRead: "automation:clipboard-read",
  clipboardWrite: "automation:clipboard-write",
  clipboardClear: "automation:clipboard-clear",
  notify: "automation:notify",
  openUrl: "automation:open-url",
  reminderCreate: "automation:reminder-create",
  reminderList: "automation:reminder-list",
  reminderDelete: "automation:reminder-delete",
  noteCreate: "automation:note-create",
  noteUpdate: "automation:note-update",
  noteOpen: "automation:note-open",
  noteList: "automation:note-list",
} as const;
