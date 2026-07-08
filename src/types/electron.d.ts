import type { AiStreamEvent, AiStreamRequest, ProviderHealth } from "@shared/ai";
import type {
  ConversationMeta,
  CreateConversationInput,
  DbResult,
  SaveMessageInput,
  StoredMessage,
} from "@shared/conversations";
import type {
  AddRuleInput,
  CandidateDisposition,
  MemoryCandidate,
  MemoryRecord,
  SaveMemoryInput,
  SaveMemoryResult,
  UpdateMemoryInput,
} from "@shared/memory";
import type {
  AppInfo,
  AutomationResult,
  ClipboardReadResult,
  CreateNoteInput,
  CreateReminderInput,
  FileHit,
  LaunchAppResult,
  NoteRecord,
  ReminderRecord,
  SearchFilesInput,
  UpdateNoteInput,
} from "@shared/automation";
import type {
  FileOpResult,
  FilePreview,
  FileProgress,
  FileRecord,
  ImportFileResult,
} from "@shared/files";
import type {
  DocResult,
  DocumentChunk,
  DocumentRecord,
  OcrProgress,
  ProcessDocumentInput,
  RetrievedChunk,
  RetrieveQuery,
  VisionAnalysis,
  VisionProgress,
} from "@shared/documents";

/**
 * Renderer-side declaration of the API exposed by `electron/preload.ts`
 * via `contextBridge.exposeInMainWorld("luna", ...)`.
 *
 * Keep this file in sync with the preload script.
 */
export interface LunaWindowApi {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
}

export interface LunaAiApi {
  start: (request: AiStreamRequest) => void;
  cancel: (requestId: string) => void;
  onEvent: (callback: (event: AiStreamEvent) => void) => () => void;
  health: (providerId: string) => Promise<ProviderHealth>;
}

export interface LunaConversationsApi {
  create: (input: CreateConversationInput) => Promise<DbResult<ConversationMeta>>;
  remove: (id: string) => Promise<DbResult<null>>;
  rename: (id: string, title: string) => Promise<DbResult<null>>;
  setPinned: (id: string, isPinned: boolean) => Promise<DbResult<null>>;
  list: () => Promise<DbResult<ConversationMeta[]>>;
  get: (id: string) => Promise<DbResult<ConversationMeta | null>>;
  saveMessage: (input: SaveMessageInput) => Promise<DbResult<null>>;
  deleteMessage: (id: string) => Promise<DbResult<null>>;
  loadMessages: (conversationId: string) => Promise<DbResult<StoredMessage[]>>;
  touch: (id: string, preview?: string) => Promise<DbResult<null>>;
}

export interface LunaMemoryApi {
  save: (input: SaveMemoryInput) => Promise<DbResult<SaveMemoryResult>>;
  update: (input: UpdateMemoryInput) => Promise<DbResult<null>>;
  archive: (id: string, isArchived: boolean) => Promise<DbResult<null>>;
  remove: (id: string) => Promise<DbResult<null>>;
  list: () => Promise<DbResult<MemoryRecord[]>>;
  search: (query: string) => Promise<DbResult<MemoryRecord[]>>;
  relevant: (query: string) => Promise<DbResult<MemoryRecord[]>>;
  addRule: (input: AddRuleInput) => Promise<DbResult<null>>;
  classify: (candidate: MemoryCandidate) => Promise<DbResult<CandidateDisposition>>;
}

export interface LunaAutomationApi {
  listApps: () => Promise<AutomationResult<AppInfo[]>>;
  launchApp: (name: string) => Promise<AutomationResult<LaunchAppResult>>;
  searchFiles: (input: SearchFilesInput) => Promise<AutomationResult<FileHit[]>>;
  openFile: (path: string) => Promise<AutomationResult<null>>;
  revealFile: (path: string) => Promise<AutomationResult<null>>;
  openFolder: (path: string) => Promise<AutomationResult<null>>;
  clipboardRead: () => Promise<AutomationResult<ClipboardReadResult>>;
  clipboardWrite: (text: string) => Promise<AutomationResult<null>>;
  clipboardClear: () => Promise<AutomationResult<null>>;
  notify: (title: string, body: string) => Promise<AutomationResult<null>>;
  openUrl: (url: string) => Promise<AutomationResult<null>>;
  createReminder: (input: CreateReminderInput) => Promise<AutomationResult<ReminderRecord>>;
  listReminders: () => Promise<AutomationResult<ReminderRecord[]>>;
  deleteReminder: (id: string) => Promise<AutomationResult<null>>;
  createNote: (input: CreateNoteInput) => Promise<AutomationResult<NoteRecord>>;
  updateNote: (input: UpdateNoteInput) => Promise<AutomationResult<NoteRecord>>;
  openNote: (id: string) => Promise<AutomationResult<null>>;
  listNotes: () => Promise<AutomationResult<NoteRecord[]>>;
}

export interface LunaFilesApi {
  pick: () => Promise<FileOpResult<string[]>>;
  import: (uploadId: string, sourcePath: string) => Promise<FileOpResult<ImportFileResult>>;
  list: () => Promise<FileOpResult<FileRecord[]>>;
  rename: (id: string, filename: string) => Promise<FileOpResult<FileRecord>>;
  remove: (id: string) => Promise<FileOpResult<null>>;
  preview: (id: string) => Promise<FileOpResult<FilePreview>>;
  open: (id: string) => Promise<FileOpResult<null>>;
  reveal: (id: string) => Promise<FileOpResult<null>>;
  pathForFile: (file: File) => string;
  onProgress: (callback: (progress: FileProgress) => void) => () => void;
}

export interface LunaDocumentsApi {
  process: (input: ProcessDocumentInput) => Promise<DocResult<DocumentRecord>>;
  get: (sourceFileId: string) => Promise<DocResult<DocumentRecord | null>>;
  list: () => Promise<DocResult<DocumentRecord[]>>;
  chunks: (documentId: string) => Promise<DocResult<DocumentChunk[]>>;
  remove: (documentId: string) => Promise<DocResult<null>>;
  retrieve: (input: RetrieveQuery) => Promise<DocResult<RetrievedChunk[]>>;
  ocrExtract: (imageId: string) => Promise<DocResult<DocumentRecord>>;
  ocrExtractBatch: (imageIds: string[]) => Promise<DocResult<DocumentRecord[]>>;
  onOcrProgress: (callback: (progress: OcrProgress) => void) => () => void;
  visionAnalyze: (imageId: string) => Promise<DocResult<VisionAnalysis>>;
  visionAnalyzeBatch: (imageIds: string[]) => Promise<DocResult<VisionAnalysis[]>>;
  visionGet: (imageId: string) => Promise<DocResult<VisionAnalysis | null>>;
  onVisionProgress: (callback: (progress: VisionProgress) => void) => () => void;
}

export interface LunaApi {
  window: LunaWindowApi;
  ai: LunaAiApi;
  conversations: LunaConversationsApi;
  memory: LunaMemoryApi;
  automation: LunaAutomationApi;
  files: LunaFilesApi;
  documents: LunaDocumentsApi;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    /** Present only when running inside Electron (injected by the preload script). */
    luna?: LunaApi;
  }
}
