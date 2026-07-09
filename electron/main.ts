import path from "node:path";
import { fileURLToPath } from "node:url";

import { BrowserWindow, app, ipcMain, shell } from "electron";

import { createLogger, setLogLevel } from "../shared/logger";
import { initDatabase } from "./backend/db/client";
import { createDefaultProviderRegistry } from "./backend/providers/registry";
import { ActivityController } from "./controllers/activity.controller";
import { AiController } from "./controllers/ai.controller";
import { ConversationsController } from "./controllers/conversations.controller";
import { DocumentsController } from "./controllers/documents.controller";
import { FilesController } from "./controllers/files.controller";
import { MemoryController } from "./controllers/memory.controller";
import { PermissionsController } from "./controllers/permissions.controller";
import { initReminders, pruneReminders } from "./automation/reminders";
import { registerActivityIpc } from "./ipc/activity.ipc";
import { registerAiIpc } from "./ipc/ai.ipc";
import { registerAutomationIpc } from "./ipc/automation.ipc";
import { registerConversationsIpc } from "./ipc/conversations.ipc";
import { registerDocumentsIpc } from "./ipc/documents.ipc";
import { registerFilesIpc } from "./ipc/files.ipc";
import { registerMemoryIpc } from "./ipc/memory.ipc";
import { registerPermissionsIpc } from "./ipc/permissions.ipc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Project layout produced by vite / vite-plugin-electron:
//
//   dist/            → built renderer (index.html + assets)
//   dist-electron/   → built main.js + preload.mjs
//
process.env.APP_ROOT = path.join(__dirname, "..");

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

// Safety net: a stray error in a background worker or third-party library
// (e.g. tesseract.js hitting a corrupt image) must not crash the app with a
// native error dialog. Log it and keep the app running; user-facing
// operations already return classified errors through their own try/catch.
const processLog = createLogger("main:process");
process.on("uncaughtException", (error) => {
  processLog.error("uncaught exception", {
    message: error instanceof Error ? error.message : String(error),
  });
});
process.on("unhandledRejection", (reason) => {
  processLog.error("unhandled rejection", {
    message: reason instanceof Error ? reason.message : String(reason),
  });
});

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    title: "Luna",
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 620,
    // Frameless window — the renderer provides a custom title bar.
    frame: false,
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Avoid a white flash: show only once the renderer has painted.
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Keep the renderer's maximize/restore icon in sync.
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximized-changed", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:maximized-changed", false);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open external links in the system browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) void shell.openExternal(url);
    return { action: "deny" };
  });

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

function registerWindowControls(): void {
  ipcMain.on("window:minimize", () => mainWindow?.minimize());

  ipcMain.on("window:toggle-maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on("window:close", () => mainWindow?.close());

  ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);
}

app.whenReady().then(() => {
  // Composition root for the main process: build dependencies once and
  // inject them downward. No module reaches for a global instance.
  if (VITE_DEV_SERVER_URL) setLogLevel("debug");
  const log = createLogger("main");

  // Required for Windows toast notifications (reminders) to attribute
  // correctly; must match the installer's appId.
  if (process.platform === "win32") app.setAppUserModelId("com.asitgiri.luna");

  registerWindowControls();
  registerAiIpc(new AiController(createDefaultProviderRegistry()));
  initDatabase();
  registerConversationsIpc(new ConversationsController());
  registerMemoryIpc(new MemoryController());
  registerAutomationIpc();
  registerFilesIpc(new FilesController());
  registerDocumentsIpc(new DocumentsController());
  registerPermissionsIpc(new PermissionsController());
  registerActivityIpc(new ActivityController());
  pruneReminders();
  initReminders();
  createMainWindow();
  log.info("app ready", { dev: Boolean(VITE_DEV_SERVER_URL) });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
