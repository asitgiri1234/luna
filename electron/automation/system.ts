import { Notification, clipboard, shell } from "electron";

import {
  AutomationError,
  type ClipboardReadResult,
} from "../../shared/automation";
import { createLogger } from "../../shared/logger";

/**
 * # System automation (main process)
 *
 * Clipboard, desktop notifications, and opening external URLs. Thin
 * wrappers over Electron APIs with classified errors so the renderer can
 * show friendly failures (clipboard unavailable, notifications
 * unsupported).
 */

const log = createLogger("main:automation:system");

export function clipboardRead(): ClipboardReadResult {
  try {
    return { text: clipboard.readText() };
  } catch (error) {
    throw new AutomationError("clipboard-unavailable", String(error));
  }
}

export function clipboardWrite(text: string): void {
  try {
    clipboard.writeText(text ?? "");
  } catch (error) {
    throw new AutomationError("clipboard-unavailable", String(error));
  }
}

export function clipboardClear(): void {
  try {
    clipboard.clear();
  } catch (error) {
    throw new AutomationError("clipboard-unavailable", String(error));
  }
}

export function notify(title: string, body: string): void {
  if (!Notification.isSupported()) {
    throw new AutomationError("notification-failed", "Notifications are not supported here.");
  }
  try {
    new Notification({ title, body }).show();
    log.info("notification shown", { title });
  } catch (error) {
    throw new AutomationError("notification-failed", String(error));
  }
}

export async function openUrl(url: string): Promise<void> {
  // Only allow http(s) to avoid launching arbitrary protocol handlers.
  if (!/^https?:\/\//i.test(url)) {
    throw new AutomationError("invalid", `Refusing to open non-web URL "${url}".`);
  }
  await shell.openExternal(url);
  log.info("opened url", { url });
}
