import { ipcMain } from "electron";

import { SHELL_CHANNELS } from "../../shared/shell";
import { getShellSnapshot, setLaunchOnStartup, setMinimizeToTray } from "../shell/shell";

/**
 * # Shell IPC registration
 *
 * Binds the Settings → General switches and the About version to the
 * main-process shell. Handlers return a `ShellSnapshot`. A rejected
 * promise means the OS or the settings file refused the change, and the
 * renderer puts the switch back.
 */

function requireBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("Expected a boolean.");
  }
  return value;
}

export function registerShellIpc(): void {
  ipcMain.handle(SHELL_CHANNELS.get, () => getShellSnapshot());
  ipcMain.handle(SHELL_CHANNELS.setLaunchOnStartup, (_event, enabled: unknown) =>
    setLaunchOnStartup(requireBoolean(enabled)),
  );
  ipcMain.handle(SHELL_CHANNELS.setMinimizeToTray, (_event, enabled: unknown) =>
    setMinimizeToTray(requireBoolean(enabled)),
  );
}
