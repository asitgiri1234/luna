import { BrowserWindow, ipcMain } from "electron";

import { FILE_CHANNELS } from "../../shared/files";
import type { FilesController } from "../controllers/files.controller";

/**
 * # Files IPC registration
 *
 * Binds `files:*` channels to the injected controller. Import streams
 * progress back on `files:progress`; everything else returns a
 * `FileOpResult` and never throws across IPC.
 */
export function registerFilesIpc(controller: FilesController): void {
  const { handle } = ipcMain;

  handle(FILE_CHANNELS.pick, (event) =>
    controller.pick(BrowserWindow.fromWebContents(event.sender)),
  );
  handle(FILE_CHANNELS.import, (event, uploadId: string, sourcePath: string) =>
    controller.import(event.sender, uploadId, sourcePath),
  );
  handle(FILE_CHANNELS.list, () => controller.list());
  handle(FILE_CHANNELS.rename, (_e, id: string, filename: string) =>
    controller.rename(id, filename),
  );
  handle(FILE_CHANNELS.remove, (_e, id: string) => controller.remove(id));
  handle(FILE_CHANNELS.preview, (_e, id: string) => controller.preview(id));
  handle(FILE_CHANNELS.open, (_e, id: string) => controller.open(id));
  handle(FILE_CHANNELS.reveal, (_e, id: string) => controller.reveal(id));
}
