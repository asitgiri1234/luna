import type { ActivityQuery, ActivityRecord, DbResult } from "@shared/activity";
import { PersistenceError } from "@shared/conversations";
import type { LunaActivityApi } from "@/types/electron";

/**
 * # Activity service (renderer)
 *
 * The only module that talks to the activity IPC bridge. Unwraps
 * `DbResult` envelopes into values or thrown `PersistenceError`s so the
 * store can use ordinary try/catch. Components never touch `window.luna`.
 */

function bridge(): LunaActivityApi {
  const api = window.luna?.activity;
  if (!api) {
    throw new PersistenceError(
      "unknown",
      "The activity bridge is unavailable. Launch Luna through Electron.",
    );
  }
  return api;
}

function unwrap<T>(result: DbResult<T>): T {
  if (result.ok) return result.data;
  throw new PersistenceError(result.code, result.message);
}

export const activityService = {
  async list(query?: ActivityQuery): Promise<ActivityRecord[]> {
    return unwrap(await bridge().list(query));
  },

  async clear(): Promise<void> {
    unwrap(await bridge().clear());
  },
};
