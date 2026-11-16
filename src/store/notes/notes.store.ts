import type { NoteRecord, ReminderRecord } from "@shared/automation";

import { create } from "zustand";

import { deskService } from "@/notes/desk.service";

/**
 * # Notes store
 *
 * Lists notes and reminders for the management page and removes the
 * one the user picks. No creation logic — chat still creates them.
 */

export type DeskStatus = "loading" | "ready" | "unavailable";

interface NotesState {
  notes: NoteRecord[];
  reminders: ReminderRecord[];
  status: DeskStatus;
  error: string | null;
  refresh: () => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  openNote: (id: string) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
}

export const useNotesStore = create<NotesState>()((set, get) => ({
  notes: [],
  reminders: [],
  status: "loading",
  error: null,

  refresh: async () => {
    try {
      const [notes, reminders] = await Promise.all([
        deskService.listNotes(),
        deskService.listReminders(),
      ]);
      if (!notes.ok) {
        set({
          status: "unavailable",
          error: notes.message,
          notes: [],
          reminders: reminders.ok ? reminders.data : [],
        });
        return;
      }
      if (!reminders.ok) {
        set({
          status: "unavailable",
          error: reminders.message,
          notes: notes.data,
          reminders: [],
        });
        return;
      }
      set({ notes: notes.data, reminders: reminders.data, status: "ready", error: null });
    } catch (error) {
      set({
        status: "unavailable",
        error: error instanceof Error ? error.message : "Notes are unavailable.",
        notes: [],
        reminders: [],
      });
    }
  },

  removeNote: async (id) => {
    const result = await deskService.deleteNote(id);
    if (!result.ok) {
      set({ error: result.message });
      return;
    }
    set({ notes: get().notes.filter((note) => note.id !== id), error: null });
  },

  openNote: async (id) => {
    const result = await deskService.openNote(id);
    if (!result.ok) set({ error: result.message });
  },

  removeReminder: async (id) => {
    const result = await deskService.deleteReminder(id);
    if (!result.ok) {
      set({ error: result.message });
      return;
    }
    set({
      reminders: get().reminders.filter((reminder) => reminder.id !== id),
      error: null,
    });
  },
}));
