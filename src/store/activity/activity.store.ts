import type { ActivityRecord, ActivityType } from "@shared/activity";

import { create } from "zustand";

import { activityService } from "@/activity/activity.service";

/**
 * # Activity store — React adapter for the Activity History
 *
 * Mirrors the recorded timeline and delegates every read/clear to the
 * activity service. No IPC or persistence logic lives here; the list
 * re-fetches whenever the type filter or search query changes.
 */

export type ActivityListStatus = "loading" | "ready" | "unavailable";
export type ActivityTypeFilter = ActivityType | "all";

interface ActivityUiState {
  activities: ActivityRecord[];
  status: ActivityListStatus;
  typeFilter: ActivityTypeFilter;
  query: string;

  refresh: () => Promise<void>;
  setTypeFilter: (filter: ActivityTypeFilter) => void;
  searchActivities: (query: string) => void;
  clearActivities: () => Promise<void>;
}

export const useActivityStore = create<ActivityUiState>()((set, get) => ({
  activities: [],
  status: "loading",
  typeFilter: "all",
  query: "",

  refresh: async () => {
    try {
      const { typeFilter, query } = get();
      const activities = await activityService.list({
        type: typeFilter,
        search: query.trim() || undefined,
      });
      set({ activities, status: "ready" });
    } catch {
      set({ status: "unavailable", activities: [] });
    }
  },

  setTypeFilter: (typeFilter) => {
    set({ typeFilter });
    void get().refresh();
  },

  searchActivities: (query) => {
    set({ query });
    void get().refresh();
  },

  clearActivities: async () => {
    try {
      await activityService.clear();
      set({ activities: [] });
    } catch {
      // Leave the current list in place if the clear failed.
    }
  },
}));
