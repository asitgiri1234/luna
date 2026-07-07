import { create } from "zustand";

import { aiCore } from "@/ai";
import type { ExecutionCard, PendingPermission } from "@/automation/executor/types";

/**
 * # Automation store — React adapter for the execution engine
 *
 * Mirrors two live streams for the UI: execution cards (from the engine)
 * and pending permission prompts (from the permission manager). Actions
 * delegate straight to the managers — no logic lives here.
 */

interface AutomationUiState {
  cards: ExecutionCard[];
  pending: PendingPermission[];
  approve: (id: string, remember: boolean) => void;
  deny: (id: string, remember: boolean) => void;
  cancel: (id: string) => void;
  clearCards: () => void;
}

const { engine, permissions } = aiCore.automation;

export const useAutomationStore = create<AutomationUiState>()((set) => {
  engine.onCards((cards) => set({ cards }));
  permissions.onPendingChange((pending) => set({ pending }));

  return {
    cards: [],
    pending: [],
    approve: (id, remember) => permissions.resolve(id, { state: "approved", remember }),
    deny: (id, remember) => permissions.resolve(id, { state: "denied", remember }),
    cancel: (id) => permissions.resolve(id, { state: "cancelled", remember: false }),
    clearCards: () => engine.clearCards(),
  };
});
