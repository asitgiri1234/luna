import { ipcMain } from "electron";

import {
  type AddRuleInput,
  MEMORY_CHANNELS,
  type MemoryCandidate,
  type SaveMemoryInput,
  type UpdateMemoryInput,
} from "../../shared/memory";
import type { MemoryController } from "../controllers/memory.controller";

/**
 * # Memory IPC registration
 *
 * Binds the `memory:*` invoke channels to the injected controller.
 * All handlers return `DbResult` values and never throw across IPC.
 */
export function registerMemoryIpc(controller: MemoryController): void {
  ipcMain.handle(MEMORY_CHANNELS.save, (_e, input: SaveMemoryInput) => controller.save(input));
  ipcMain.handle(MEMORY_CHANNELS.update, (_e, input: UpdateMemoryInput) =>
    controller.update(input),
  );
  ipcMain.handle(MEMORY_CHANNELS.archive, (_e, id: string, isArchived: boolean) =>
    controller.archive(id, isArchived),
  );
  ipcMain.handle(MEMORY_CHANNELS.remove, (_e, id: string) => controller.remove(id));
  ipcMain.handle(MEMORY_CHANNELS.list, () => controller.list());
  ipcMain.handle(MEMORY_CHANNELS.search, (_e, query: string) => controller.search(query));
  ipcMain.handle(MEMORY_CHANNELS.relevant, (_e, query: string) => controller.relevant(query));
  ipcMain.handle(MEMORY_CHANNELS.addRule, (_e, input: AddRuleInput) => controller.addRule(input));
  ipcMain.handle(MEMORY_CHANNELS.classify, (_e, candidate: MemoryCandidate) =>
    controller.classify(candidate),
  );
}
