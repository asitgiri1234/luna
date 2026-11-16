import type { AutomationResult, NoteRecord, ReminderRecord } from "@shared/automation";
import type { LunaAutomationApi } from "@/types/electron";

/**
 * # Notes and reminders (renderer)
 *
 * The only module the Notes page uses to list and remove notes and
 * reminders. Creating them from chat stays on the automation executors.
 */

function bridge(): LunaAutomationApi {
  const api = window.luna?.automation;
  if (!api) {
    throw new Error("The desktop bridge is unavailable. Launch Luna through Electron.");
  }
  return api;
}

export const deskService = {
  listNotes(): Promise<AutomationResult<NoteRecord[]>> {
    return bridge().listNotes();
  },

  deleteNote(id: string): Promise<AutomationResult<null>> {
    return bridge().deleteNote(id);
  },

  openNote(id: string): Promise<AutomationResult<null>> {
    return bridge().openNote(id);
  },

  listReminders(): Promise<AutomationResult<ReminderRecord[]>> {
    return bridge().listReminders();
  },

  deleteReminder(id: string): Promise<AutomationResult<null>> {
    return bridge().deleteReminder(id);
  },
};
