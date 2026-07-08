import { contextBridge, ipcRenderer, webUtils } from "electron";

import {
  AI_CHANNELS,
  type AiStreamEvent,
  type AiStreamRequest,
  type ProviderHealth,
} from "../shared/ai";
import {
  CONVERSATION_CHANNELS,
  type ConversationMeta,
  type CreateConversationInput,
  type DbResult,
  type SaveMessageInput,
  type StoredMessage,
} from "../shared/conversations";
import {
  type AddRuleInput,
  type CandidateDisposition,
  MEMORY_CHANNELS,
  type MemoryCandidate,
  type MemoryRecord,
  type SaveMemoryInput,
  type SaveMemoryResult,
  type UpdateMemoryInput,
} from "../shared/memory";
import {
  AUTOMATION_CHANNELS,
  type AppInfo,
  type AutomationResult,
  type ClipboardReadResult,
  type CreateNoteInput,
  type CreateReminderInput,
  type FileHit,
  type LaunchAppResult,
  type NoteRecord,
  type ReminderRecord,
  type SearchFilesInput,
  type UpdateNoteInput,
} from "../shared/automation";
import {
  FILE_CHANNELS,
  type FileOpResult,
  type FilePreview,
  type FileProgress,
  type FileRecord,
  type ImportFileResult,
} from "../shared/files";
import {
  DOCUMENT_CHANNELS,
  type DocResult,
  type DocumentChunk,
  type DocumentRecord,
  type ProcessDocumentInput,
  type RetrievedChunk,
  type RetrieveQuery,
} from "../shared/documents";

/**
 * The only bridge between the renderer and the main process.
 * Keep this surface minimal and typed — everything exposed here is
 * reachable from web content.
 *
 * The renderer-side type declaration lives in `src/types/electron.d.ts`.
 */
const lunaApi = {
  window: {
    minimize: (): void => ipcRenderer.send("window:minimize"),
    toggleMaximize: (): void => ipcRenderer.send("window:toggle-maximize"),
    close: (): void => ipcRenderer.send("window:close"),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window:is-maximized"),
    onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: boolean): void =>
        callback(value);
      ipcRenderer.on("window:maximized-changed", listener);
      return () => ipcRenderer.off("window:maximized-changed", listener);
    },
  },
  ai: {
    start: (request: AiStreamRequest): void => ipcRenderer.send(AI_CHANNELS.start, request),
    cancel: (requestId: string): void => ipcRenderer.send(AI_CHANNELS.cancel, requestId),
    onEvent: (callback: (event: AiStreamEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: AiStreamEvent): void =>
        callback(value);
      ipcRenderer.on(AI_CHANNELS.event, listener);
      return () => ipcRenderer.off(AI_CHANNELS.event, listener);
    },
    health: (providerId: string): Promise<ProviderHealth> =>
      ipcRenderer.invoke(AI_CHANNELS.health, providerId),
  },
  conversations: {
    create: (input: CreateConversationInput): Promise<DbResult<ConversationMeta>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.create, input),
    remove: (id: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.remove, id),
    rename: (id: string, title: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.rename, id, title),
    setPinned: (id: string, isPinned: boolean): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.setPinned, id, isPinned),
    list: (): Promise<DbResult<ConversationMeta[]>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.list),
    get: (id: string): Promise<DbResult<ConversationMeta | null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.get, id),
    saveMessage: (input: SaveMessageInput): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.saveMessage, input),
    deleteMessage: (id: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.deleteMessage, id),
    loadMessages: (conversationId: string): Promise<DbResult<StoredMessage[]>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.loadMessages, conversationId),
    touch: (id: string, preview?: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(CONVERSATION_CHANNELS.touch, id, preview),
  },
  memory: {
    save: (input: SaveMemoryInput): Promise<DbResult<SaveMemoryResult>> =>
      ipcRenderer.invoke(MEMORY_CHANNELS.save, input),
    update: (input: UpdateMemoryInput): Promise<DbResult<null>> =>
      ipcRenderer.invoke(MEMORY_CHANNELS.update, input),
    archive: (id: string, isArchived: boolean): Promise<DbResult<null>> =>
      ipcRenderer.invoke(MEMORY_CHANNELS.archive, id, isArchived),
    remove: (id: string): Promise<DbResult<null>> =>
      ipcRenderer.invoke(MEMORY_CHANNELS.remove, id),
    list: (): Promise<DbResult<MemoryRecord[]>> => ipcRenderer.invoke(MEMORY_CHANNELS.list),
    search: (query: string): Promise<DbResult<MemoryRecord[]>> =>
      ipcRenderer.invoke(MEMORY_CHANNELS.search, query),
    relevant: (query: string): Promise<DbResult<MemoryRecord[]>> =>
      ipcRenderer.invoke(MEMORY_CHANNELS.relevant, query),
    addRule: (input: AddRuleInput): Promise<DbResult<null>> =>
      ipcRenderer.invoke(MEMORY_CHANNELS.addRule, input),
    classify: (candidate: MemoryCandidate): Promise<DbResult<CandidateDisposition>> =>
      ipcRenderer.invoke(MEMORY_CHANNELS.classify, candidate),
  },
  automation: {
    listApps: (): Promise<AutomationResult<AppInfo[]>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.appsList),
    launchApp: (name: string): Promise<AutomationResult<LaunchAppResult>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.appLaunch, name),
    searchFiles: (input: SearchFilesInput): Promise<AutomationResult<FileHit[]>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.fileSearch, input),
    openFile: (path: string): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.fileOpen, path),
    revealFile: (path: string): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.fileReveal, path),
    openFolder: (path: string): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.folderOpen, path),
    clipboardRead: (): Promise<AutomationResult<ClipboardReadResult>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.clipboardRead),
    clipboardWrite: (text: string): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.clipboardWrite, text),
    clipboardClear: (): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.clipboardClear),
    notify: (title: string, body: string): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.notify, title, body),
    openUrl: (url: string): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.openUrl, url),
    createReminder: (input: CreateReminderInput): Promise<AutomationResult<ReminderRecord>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.reminderCreate, input),
    listReminders: (): Promise<AutomationResult<ReminderRecord[]>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.reminderList),
    deleteReminder: (id: string): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.reminderDelete, id),
    createNote: (input: CreateNoteInput): Promise<AutomationResult<NoteRecord>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.noteCreate, input),
    updateNote: (input: UpdateNoteInput): Promise<AutomationResult<NoteRecord>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.noteUpdate, input),
    openNote: (id: string): Promise<AutomationResult<null>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.noteOpen, id),
    listNotes: (): Promise<AutomationResult<NoteRecord[]>> =>
      ipcRenderer.invoke(AUTOMATION_CHANNELS.noteList),
  },
  files: {
    pick: (): Promise<FileOpResult<string[]>> => ipcRenderer.invoke(FILE_CHANNELS.pick),
    import: (uploadId: string, sourcePath: string): Promise<FileOpResult<ImportFileResult>> =>
      ipcRenderer.invoke(FILE_CHANNELS.import, uploadId, sourcePath),
    list: (): Promise<FileOpResult<FileRecord[]>> => ipcRenderer.invoke(FILE_CHANNELS.list),
    rename: (id: string, filename: string): Promise<FileOpResult<FileRecord>> =>
      ipcRenderer.invoke(FILE_CHANNELS.rename, id, filename),
    remove: (id: string): Promise<FileOpResult<null>> =>
      ipcRenderer.invoke(FILE_CHANNELS.remove, id),
    preview: (id: string): Promise<FileOpResult<FilePreview>> =>
      ipcRenderer.invoke(FILE_CHANNELS.preview, id),
    open: (id: string): Promise<FileOpResult<null>> =>
      ipcRenderer.invoke(FILE_CHANNELS.open, id),
    reveal: (id: string): Promise<FileOpResult<null>> =>
      ipcRenderer.invoke(FILE_CHANNELS.reveal, id),
    /** Resolve an absolute path for a dropped File (Electron webUtils). */
    pathForFile: (file: File): string => webUtils.getPathForFile(file),
    onProgress: (callback: (progress: FileProgress) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, value: FileProgress): void =>
        callback(value);
      ipcRenderer.on(FILE_CHANNELS.progress, listener);
      return () => ipcRenderer.off(FILE_CHANNELS.progress, listener);
    },
  },
  documents: {
    process: (input: ProcessDocumentInput): Promise<DocResult<DocumentRecord>> =>
      ipcRenderer.invoke(DOCUMENT_CHANNELS.process, input),
    get: (sourceFileId: string): Promise<DocResult<DocumentRecord | null>> =>
      ipcRenderer.invoke(DOCUMENT_CHANNELS.get, sourceFileId),
    list: (): Promise<DocResult<DocumentRecord[]>> => ipcRenderer.invoke(DOCUMENT_CHANNELS.list),
    chunks: (documentId: string): Promise<DocResult<DocumentChunk[]>> =>
      ipcRenderer.invoke(DOCUMENT_CHANNELS.chunks, documentId),
    remove: (documentId: string): Promise<DocResult<null>> =>
      ipcRenderer.invoke(DOCUMENT_CHANNELS.remove, documentId),
    retrieve: (input: RetrieveQuery): Promise<DocResult<RetrievedChunk[]>> =>
      ipcRenderer.invoke(DOCUMENT_CHANNELS.retrieve, input),
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld("luna", lunaApi);
