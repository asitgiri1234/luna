import { ipcMain } from "electron";

import {
  DOCUMENT_CHANNELS,
  type ProcessDocumentInput,
  type RetrieveQuery,
} from "../../shared/documents";
import type { DocumentsController } from "../controllers/documents.controller";

/**
 * # Documents IPC registration
 *
 * Binds `documents:*` channels to the injected controller. Every handler
 * returns a `DocResult` and never throws across IPC.
 */
export function registerDocumentsIpc(controller: DocumentsController): void {
  const { handle } = ipcMain;

  handle(DOCUMENT_CHANNELS.process, (_e, input: ProcessDocumentInput) => controller.process(input));
  handle(DOCUMENT_CHANNELS.get, (_e, sourceFileId: string) => controller.get(sourceFileId));
  handle(DOCUMENT_CHANNELS.list, () => controller.list());
  handle(DOCUMENT_CHANNELS.chunks, (_e, documentId: string) => controller.chunks(documentId));
  handle(DOCUMENT_CHANNELS.remove, (_e, documentId: string) => controller.remove(documentId));
  handle(DOCUMENT_CHANNELS.retrieve, (_e, input: RetrieveQuery) => controller.retrieve(input));
  handle(DOCUMENT_CHANNELS.ocrExtract, (event, imageId: string) =>
    controller.ocrExtract(event.sender, imageId),
  );
  handle(DOCUMENT_CHANNELS.ocrExtractBatch, (event, imageIds: string[]) =>
    controller.ocrExtractBatch(event.sender, imageIds),
  );
}
