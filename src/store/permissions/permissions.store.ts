import type { PermissionId, PermissionRecord } from "@shared/permissions";

import { create } from "zustand";

import { permissionService } from "@/permissions/permission.service";

/**
 * # Permissions store — React adapter for the Privacy Dashboard
 *
 * Mirrors the permission list and delegates enable/disable to the
 * permission service. No IPC or persistence logic lives here.
 */

export type PermissionsStatus = "loading" | "ready" | "unavailable";

interface PermissionsState {
  permissions: PermissionRecord[];
  status: PermissionsStatus;
  /** Ids currently being toggled (to disable their control). */
  pending: Record<string, boolean>;

  refresh: () => Promise<void>;
  setEnabled: (id: PermissionId, enabled: boolean) => Promise<void>;
}

export const usePermissionsStore = create<PermissionsState>()((set) => ({
  permissions: [],
  status: "loading",
  pending: {},

  refresh: async () => {
    try {
      set({ permissions: await permissionService.list(), status: "ready" });
    } catch {
      set({ permissions: [], status: "unavailable" });
    }
  },

  setEnabled: async (id, enabled) => {
    set((state) => ({ pending: { ...state.pending, [id]: true } }));
    try {
      const updated = enabled
        ? await permissionService.grant(id)
        : await permissionService.revoke(id);
      set((state) => ({
        permissions: state.permissions.map((permission) =>
          permission.id === id ? updated : permission,
        ),
      }));
    } catch {
      // Leave the previous state on failure; the toggle simply won't move.
    } finally {
      set((state) => {
        const pending = { ...state.pending };
        delete pending[id];
        return { pending };
      });
    }
  },
}));
