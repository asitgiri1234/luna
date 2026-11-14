/**
 * # Shared shell contract
 *
 * Startup and tray preferences cross IPC between the Settings page and
 * the main process, which is the only place that can touch the Windows
 * login item and the system tray. The version string is included so About
 * can show `app.getVersion()` without a second round trip.
 */

export interface ShellSettings {
  /** Start Luna when the user signs in to Windows. Default off. */
  launchOnStartup: boolean;
  /**
   * Closing the window hides Luna to the tray instead of quitting.
   * Default on, matching the Settings switch.
   */
  minimizeToTray: boolean;
}

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  launchOnStartup: false,
  minimizeToTray: true,
};

export interface ShellSnapshot extends ShellSettings {
  /** `app.getVersion()` — the packaged app version, not a hardcoded label. */
  version: string;
}

export const SHELL_CHANNELS = {
  get: "shell:get",
  setLaunchOnStartup: "shell:set-launch-on-startup",
  setMinimizeToTray: "shell:set-minimize-to-tray",
} as const;
