import { osBridge, unwrap } from "../os-bridge";

/**
 * # Notification service (renderer)
 *
 * Thin renderer-side helper for showing desktop notifications through
 * the main process. Used by the reminder executor and available to any
 * future feature that needs to notify the user. Failures surface as a
 * thrown `AutomationError` the caller can handle gracefully.
 */
export const notificationService = {
  async show(title: string, body: string): Promise<void> {
    unwrap(await osBridge().notify(title, body));
  },
};
