import { ipcMain } from "electron";

import {
  AUTOMATION_CHANNELS,
  type CreateNoteInput,
  type CreateReminderInput,
  type SearchFilesInput,
  type UpdateNoteInput,
} from "../../shared/automation";
import { launchApplication, listApplications } from "../automation/applications";
import { openFile, openFolder, revealFile, searchFiles } from "../automation/files";
import { createNote, listNotes, openNote, updateNote } from "../automation/notes";
import {
  createReminder,
  deleteReminder,
  listReminders,
} from "../automation/reminders";
import {
  clipboardClear,
  clipboardRead,
  clipboardWrite,
  notify,
  openUrl,
} from "../automation/system";
import { runAutomation } from "../controllers/automation.controller";

/**
 * # Automation IPC registration
 *
 * Binds `automation:*` channels to the OS layer. Every handler returns
 * an `AutomationResult` and never throws across IPC. This is the single
 * boundary the renderer's executors cross to reach the operating system.
 */
export function registerAutomationIpc(): void {
  const { handle } = ipcMain;

  handle(AUTOMATION_CHANNELS.appsList, () => runAutomation("apps-list", listApplications));
  handle(AUTOMATION_CHANNELS.appLaunch, (_e, name: string) =>
    runAutomation("app-launch", () => launchApplication(name)),
  );

  handle(AUTOMATION_CHANNELS.fileSearch, (_e, input: SearchFilesInput) =>
    runAutomation("file-search", () => searchFiles(input)),
  );
  handle(AUTOMATION_CHANNELS.fileOpen, (_e, filePath: string) =>
    runAutomation("file-open", () => openFile(filePath)),
  );
  handle(AUTOMATION_CHANNELS.fileReveal, (_e, filePath: string) =>
    runAutomation("file-reveal", () => revealFile(filePath)),
  );
  handle(AUTOMATION_CHANNELS.folderOpen, (_e, folderPath: string) =>
    runAutomation("folder-open", () => openFolder(folderPath)),
  );

  handle(AUTOMATION_CHANNELS.clipboardRead, () => runAutomation("clipboard-read", clipboardRead));
  handle(AUTOMATION_CHANNELS.clipboardWrite, (_e, text: string) =>
    runAutomation("clipboard-write", () => clipboardWrite(text)),
  );
  handle(AUTOMATION_CHANNELS.clipboardClear, () =>
    runAutomation("clipboard-clear", clipboardClear),
  );

  handle(AUTOMATION_CHANNELS.notify, (_e, title: string, body: string) =>
    runAutomation("notify", () => notify(title, body)),
  );
  handle(AUTOMATION_CHANNELS.openUrl, (_e, url: string) =>
    runAutomation("open-url", () => openUrl(url)),
  );

  handle(AUTOMATION_CHANNELS.reminderCreate, (_e, input: CreateReminderInput) =>
    runAutomation("reminder-create", () => createReminder(input)),
  );
  handle(AUTOMATION_CHANNELS.reminderList, () => runAutomation("reminder-list", listReminders));
  handle(AUTOMATION_CHANNELS.reminderDelete, (_e, id: string) =>
    runAutomation("reminder-delete", () => deleteReminder(id)),
  );

  handle(AUTOMATION_CHANNELS.noteCreate, (_e, input: CreateNoteInput) =>
    runAutomation("note-create", () => createNote(input)),
  );
  handle(AUTOMATION_CHANNELS.noteUpdate, (_e, input: UpdateNoteInput) =>
    runAutomation("note-update", () => updateNote(input)),
  );
  handle(AUTOMATION_CHANNELS.noteOpen, (_e, id: string) =>
    runAutomation("note-open", () => openNote(id)),
  );
  handle(AUTOMATION_CHANNELS.noteList, () => runAutomation("note-list", listNotes));
}
