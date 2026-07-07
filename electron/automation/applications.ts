import { exec } from "node:child_process";
import { promisify } from "node:util";

import { AutomationError, type AppInfo, type LaunchAppResult } from "../../shared/automation";
import { createLogger } from "../../shared/logger";

/**
 * # Application automation (main process, Windows)
 *
 * Detects and launches desktop applications. Launching uses the Windows
 * shell `start` verb so registered apps, UWP shims, and protocol URIs
 * all resolve the same way. Everything is best-effort and degrades to a
 * classified `AutomationError`.
 */

const execAsync = promisify(exec);
const log = createLogger("main:automation:apps");

interface AppSpec {
  key: string;
  name: string;
  aliases: string[];
  /** Process image name used to detect "already running". */
  processName: string;
  /** Argument passed to `start` (exe on PATH, UWP shim, or protocol). */
  launchTarget: string;
}

const KNOWN_APPS: AppSpec[] = [
  { key: "chrome", name: "Google Chrome", aliases: ["google chrome"], processName: "chrome.exe", launchTarget: "chrome" },
  { key: "edge", name: "Microsoft Edge", aliases: ["microsoft edge"], processName: "msedge.exe", launchTarget: "msedge" },
  { key: "firefox", name: "Mozilla Firefox", aliases: [], processName: "firefox.exe", launchTarget: "firefox" },
  { key: "spotify", name: "Spotify", aliases: [], processName: "Spotify.exe", launchTarget: "spotify:" },
  { key: "vscode", name: "Visual Studio Code", aliases: ["vs code", "code", "visual studio code"], processName: "Code.exe", launchTarget: "code" },
  { key: "calculator", name: "Calculator", aliases: ["calc"], processName: "CalculatorApp.exe", launchTarget: "calculator:" },
  { key: "notepad", name: "Notepad", aliases: [], processName: "notepad.exe", launchTarget: "notepad" },
  { key: "explorer", name: "File Explorer", aliases: ["file explorer", "files"], processName: "explorer.exe", launchTarget: "explorer" },
  { key: "terminal", name: "Windows Terminal", aliases: ["cmd", "command prompt"], processName: "WindowsTerminal.exe", launchTarget: "wt" },
  { key: "word", name: "Microsoft Word", aliases: [], processName: "WINWORD.EXE", launchTarget: "winword" },
  { key: "excel", name: "Microsoft Excel", aliases: [], processName: "EXCEL.EXE", launchTarget: "excel" },
];

function resolveApp(name: string): AppSpec | undefined {
  const needle = name.trim().toLowerCase();
  return KNOWN_APPS.find(
    (app) =>
      app.key === needle ||
      app.name.toLowerCase() === needle ||
      app.aliases.includes(needle) ||
      needle.includes(app.key),
  );
}

async function isRunning(processName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `tasklist /FI "IMAGENAME eq ${processName}" /NH`,
      { windowsHide: true },
    );
    return stdout.toLowerCase().includes(processName.toLowerCase());
  } catch {
    return false;
  }
}

/** Best-effort focus of an already-running app (see windows/window.service). */
async function focus(spec: AppSpec): Promise<boolean> {
  try {
    // WScript.Shell AppActivate matches on window title; use the app name.
    await execAsync(
      `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).AppActivate('${spec.name}')"`,
      { windowsHide: true },
    );
    return true;
  } catch {
    return false;
  }
}

/** The known apps, flagged by whether they appear to be installed. */
export async function listApplications(): Promise<AppInfo[]> {
  const results = await Promise.all(
    KNOWN_APPS.map(async (app) => ({
      key: app.key,
      name: app.name,
      installed: await isInstalled(app),
    })),
  );
  return results;
}

async function isInstalled(spec: AppSpec): Promise<boolean> {
  // Protocol/UWP targets can't be probed with `where`; assume available.
  if (spec.launchTarget.endsWith(":")) return true;
  try {
    await execAsync(`where ${spec.launchTarget}`, { windowsHide: true });
    return true;
  } catch {
    return await isRunning(spec.processName);
  }
}

export async function launchApplication(name: string): Promise<LaunchAppResult> {
  const spec = resolveApp(name);
  if (!spec) {
    throw new AutomationError("app-unknown", `Luna doesn't know the application "${name}".`);
  }

  if (await isRunning(spec.processName)) {
    const focused = await focus(spec);
    log.info("app already running", { app: spec.key, focused });
    return { app: spec.name, alreadyRunning: true, focused };
  }

  try {
    // `start "" target` — empty title arg avoids quoting pitfalls.
    await execAsync(`start "" "${spec.launchTarget}"`, { shell: "cmd.exe", windowsHide: true });
    log.info("app launched", { app: spec.key });
    return { app: spec.name, alreadyRunning: false, focused: true };
  } catch (error) {
    log.warn("app launch failed", { app: spec.key, error: String(error) });
    throw new AutomationError(
      "app-not-found",
      `Couldn't launch ${spec.name}. It may not be installed.`,
    );
  }
}
