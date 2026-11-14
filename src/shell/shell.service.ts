import type { ShellSnapshot } from "@shared/shell";

import type { LunaShellApi } from "@/types/electron";

/**
 * # Shell service (renderer)
 *
 * The only module that talks to the shell IPC bridge. Settings reads the
 * snapshot (version, launch on startup, minimize to tray) and sends
 * toggles here. Components never touch `window.luna`.
 */

function bridge(): LunaShellApi {
  const api = window.luna?.shell;
  if (!api) {
    throw new Error("The shell bridge is unavailable. Launch Luna through Electron.");
  }
  return api;
}

export const shellService = {
  get(): Promise<ShellSnapshot> {
    return bridge().get();
  },

  setLaunchOnStartup(enabled: boolean): Promise<ShellSnapshot> {
    return bridge().setLaunchOnStartup(enabled);
  },

  setMinimizeToTray(enabled: boolean): Promise<ShellSnapshot> {
    return bridge().setMinimizeToTray(enabled);
  },
};
