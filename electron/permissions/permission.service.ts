import { PersistenceError } from "../../shared/conversations";
import {
  PERMISSION_CATALOG,
  type PermissionDefinition,
  type PermissionId,
  type PermissionRecord,
  type PermissionStatus,
  isPermissionId,
} from "../../shared/permissions";
import { createLogger } from "../../shared/logger";
import { PermissionRepository, type PermissionState } from "./permission.repository";

/**
 * # PermissionService (main process)
 *
 * The Privacy Dashboard's brain. Merges the static permission catalog
 * (names / descriptions / reasons) with the persisted state (status +
 * last-used), seeding defaults on first use. Enabling / disabling a
 * permission only records the user's choice — enforcement stays with each
 * capability's own code.
 */

const log = createLogger("main:permissions");

export class PermissionService {
  constructor(private readonly repository: PermissionRepository = new PermissionRepository()) {}

  /** Every permission Luna uses, in display order, with live state. */
  listPermissions(): PermissionRecord[] {
    const states = new Map(this.repository.list().map((state) => [state.id, state]));
    return PERMISSION_CATALOG.map((definition) => {
      let state = states.get(definition.id);
      if (!state) {
        // Seed the default so status/updatedAt are consistent going forward.
        this.repository.setStatus(definition.id, definition.defaultStatus);
        state = this.repository.get(definition.id);
      }
      return this.toRecord(definition, state);
    });
  }

  grantPermission(id: PermissionId): PermissionRecord {
    return this.applyStatus(id, "allowed");
  }

  revokePermission(id: PermissionId): PermissionRecord {
    return this.applyStatus(id, "disabled");
  }

  getPermissionStatus(id: PermissionId): PermissionStatus {
    return this.repository.get(id)?.status ?? this.definition(id).defaultStatus;
  }

  /** Marks a capability as used now (for the "Last used" display). */
  recordUsage(id: string): void {
    if (isPermissionId(id)) this.repository.touch(id, Date.now());
  }

  private applyStatus(id: PermissionId, status: PermissionStatus): PermissionRecord {
    const definition = this.definition(id);
    this.repository.setStatus(id, status);
    log.info("permission updated", { id, status });
    return this.toRecord(definition, this.repository.get(id));
  }

  private definition(id: PermissionId): PermissionDefinition {
    const definition = PERMISSION_CATALOG.find((entry) => entry.id === id);
    if (!definition) throw new PersistenceError("not-found", `Unknown permission "${id}".`);
    return definition;
  }

  private toRecord(definition: PermissionDefinition, state: PermissionState | undefined): PermissionRecord {
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      reason: definition.reason,
      status: state?.status ?? definition.defaultStatus,
      lastUsed: state?.lastUsed ?? null,
      updatedAt: state?.updatedAt ?? Date.now(),
    };
  }
}
