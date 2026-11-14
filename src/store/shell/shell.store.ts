import { DEFAULT_SHELL_SETTINGS, type ShellSnapshot } from "@shared/shell";
import { create } from "zustand";

import { shellService } from "@/shell/shell.service";

/**
 * # Shell store — React adapter for the main-process shell
 *
 * Mirrors launch-on-startup, minimize-to-tray, and the app version.
 * Toggles update the switch immediately and revert if the main process
 * rejects the change. No login-item or tray logic lives here.
 */

export type ShellStatus = "loading" | "ready" | "unavailable";

interface ShellUiState extends ShellSnapshot {
  status: ShellStatus;
  error: string | null;

  refresh: () => Promise<void>;
  setLaunchOnStartup: (enabled: boolean) => Promise<void>;
  setMinimizeToTray: (enabled: boolean) => Promise<void>;
}

let epoch = 0;

function failureMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("could not save")) return "Luna could not save that setting.";
  if (message.includes("startup setting")) return "Windows could not update the startup setting.";
  return fallback;
}

function apply(snapshot: ShellSnapshot) {
  return { ...snapshot, status: "ready" as const, error: null };
}

export const useShellStore = create<ShellUiState>()((set, get) => ({
  version: "",
  ...DEFAULT_SHELL_SETTINGS,
  status: "loading",
  error: null,

  refresh: async () => {
    const ticket = ++epoch;
    try {
      const snapshot = await shellService.get();
      if (ticket !== epoch) return;
      set(apply(snapshot));
    } catch {
      if (ticket !== epoch) return;
      set({ status: "unavailable" });
    }
  },

  setLaunchOnStartup: async (enabled) => {
    const ticket = ++epoch;
    const previous = get().launchOnStartup;
    set({ launchOnStartup: enabled, error: null });
    try {
      const snapshot = await shellService.setLaunchOnStartup(enabled);
      if (ticket !== epoch) return;
      set(apply(snapshot));
    } catch (error) {
      if (ticket !== epoch) return;
      set({
        launchOnStartup: previous,
        error: failureMessage(error, "Windows could not update the startup setting."),
      });
    }
  },

  setMinimizeToTray: async (enabled) => {
    const ticket = ++epoch;
    const previous = get().minimizeToTray;
    set({ minimizeToTray: enabled, error: null });
    try {
      const snapshot = await shellService.setMinimizeToTray(enabled);
      if (ticket !== epoch) return;
      set(apply(snapshot));
    } catch (error) {
      if (ticket !== epoch) return;
      set({
        minimizeToTray: previous,
        error: failureMessage(error, "Luna could not save that setting."),
      });
    }
  },
}));
