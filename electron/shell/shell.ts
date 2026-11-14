import fs from "node:fs";
import path from "node:path";

import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";

import {
  DEFAULT_SHELL_SETTINGS,
  type ShellSettings,
  type ShellSnapshot,
} from "../../shared/shell";
import { createLogger } from "../../shared/logger";

import { TRAY_ICON_DATA_URL } from "./tray-icon";

/**
 * # Shell (main process)
 *
 * Owns the two Settings → General switches:
 *
 * - Launch on startup writes a Windows login item (`setLoginItemSettings`)
 *   and persists the choice in the user-data directory. The same call runs
 *   again on the next launch so a reinstall of the executable stays in sync.
 * - Minimize to tray keeps the process alive when the window closes, and
 *   puts a tray icon up with Show and Quit. With the switch off, close
 *   quits — the behavior Luna had before this existed.
 *
 * The main process is the source of truth. The renderer only mirrors it.
 */

const log = createLogger("main:shell");
const SETTINGS_FILE = "shell.json";

let settings: ShellSettings = { ...DEFAULT_SHELL_SETTINGS };
let currentWindow: BrowserWindow | null = null;
let openWindow: (() => void) | null = null;
let tray: Tray | null = null;
let quitting = false;

function settingsPath(): string {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

function parseSettings(value: unknown): ShellSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SHELL_SETTINGS };
  const record = value as Record<string, unknown>;
  return {
    launchOnStartup: record.launchOnStartup === true,
    minimizeToTray:
      typeof record.minimizeToTray === "boolean"
        ? record.minimizeToTray
        : DEFAULT_SHELL_SETTINGS.minimizeToTray,
  };
}

function readSettings(): ShellSettings {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    return parseSettings(parsed);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      log.warn("could not read shell settings; using defaults", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return { ...DEFAULT_SHELL_SETTINGS };
  }
}

function writeSettings(next: ShellSettings): void {
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

/**
 * Login-item arguments for an unpackaged run. Vite starts Electron as
 * `electron .`, so `process.argv` has no main script. Pass the app
 * directory or Windows starts a bare Electron window. A packaged build
 * launches Luna.exe and needs no extra arguments.
 */
function devLaunchArgs(): string[] | undefined {
  if (app.isPackaged || process.platform !== "win32") return undefined;
  const appPath = app.getAppPath();
  if (!appPath) return undefined;
  return [/\s/.test(appPath) ? `"${appPath}"` : appPath];
}

function applyLaunchOnStartup(openAtLogin: boolean): void {
  if (process.platform !== "win32" && process.platform !== "darwin") {
    throw new Error("Launch on startup is not supported on this system.");
  }

  const launch: Electron.Settings = { openAtLogin };
  const args = devLaunchArgs();
  if (args) launch.args = args;

  app.setLoginItemSettings(launch);
  log.info("login item updated", {
    openAtLogin,
    packaged: app.isPackaged,
    args: launch.args ?? [],
  });
}

function trayIcon() {
  const image = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  if (image.isEmpty()) {
    throw new Error("Tray icon failed to decode.");
  }
  return image;
}

function destroyTray(): void {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

function ensureTray(): boolean {
  if (tray && !tray.isDestroyed()) return true;
  try {
    const created = new Tray(trayIcon());
    created.setToolTip("Luna");
    created.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show", click: () => showShellWindow() },
        { label: "Quit", click: () => app.quit() },
      ]),
    );
    created.on("click", () => showShellWindow());
    created.on("double-click", () => showShellWindow());
    tray = created;
    return true;
  } catch (error) {
    log.error("could not create the tray icon", {
      message: error instanceof Error ? error.message : String(error),
    });
    tray = null;
    return false;
  }
}

function syncTray(): void {
  if (settings.minimizeToTray) {
    ensureTray();
  } else {
    destroyTray();
  }
}

function snapshot(): ShellSnapshot {
  return { version: app.getVersion(), ...settings };
}

/** Called once, after `app.whenReady()`, before the window is created. */
export function initShell(): void {
  settings = readSettings();
  try {
    applyLaunchOnStartup(settings.launchOnStartup);
  } catch (error) {
    log.error("could not apply the saved login item", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  syncTray();
  log.info("shell ready", { ...settings });
}

/** `createMainWindow`, so Show can rebuild the window after a real close. */
export function setShellWindowOpener(opener: () => void): void {
  openWindow = opener;
}

export function attachShellWindow(win: BrowserWindow): void {
  currentWindow = win;

  win.on("close", (event) => {
    if (quitting || !settings.minimizeToTray) return;
    // If the tray cannot be created, close for real so the process cannot
    // be left running with no way back to the window.
    if (!ensureTray()) return;
    event.preventDefault();
    win.hide();
  });

  win.on("closed", () => {
    if (currentWindow === win) currentWindow = null;
  });
}

export function showShellWindow(): void {
  const win = currentWindow;
  if (!win || win.isDestroyed()) {
    if (app.isReady()) openWindow?.();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/** Set from `before-quit` so the close handler lets the window go. */
export function markShellQuitting(): void {
  quitting = true;
  destroyTray();
}

export function getShellSnapshot(): ShellSnapshot {
  return snapshot();
}

export function setLaunchOnStartup(enabled: boolean): ShellSnapshot {
  const previous = settings;
  const next = { ...settings, launchOnStartup: enabled };
  try {
    writeSettings(next);
  } catch (error) {
    log.error("launch on startup was not saved", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Luna could not save that setting.");
  }
  try {
    applyLaunchOnStartup(enabled);
  } catch (error) {
    try {
      writeSettings(previous);
    } catch {
      // The login item was not changed; keep the previous file if we can.
    }
    log.error("launch on startup was not applied", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Windows could not update the startup setting.");
  }
  settings = next;
  return snapshot();
}

export function setMinimizeToTray(enabled: boolean): ShellSnapshot {
  const previous = settings;
  const next = { ...settings, minimizeToTray: enabled };
  try {
    writeSettings(next);
  } catch (error) {
    settings = previous;
    log.error("minimize to tray was not saved", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Luna could not save that setting.");
  }
  settings = next;
  syncTray();
  return snapshot();
}
