# Luna — project status

Handoff for the next agent. The GitHub repo is
[asitgiri1234/luna](https://github.com/asitgiri1234/luna). The local
folder `Documents/Luna` tracks `origin/main`.

Luna is a privacy-first desktop AI assistant. Electron + React 19 +
TypeScript, Tailwind, a local Ollama model, and SQLite (Drizzle). The
database is Electron's user-data directory, which on this machine is
`%APPDATA%/Luna/luna.db` (the product name, capital L). `shell.json`
sits next to it. Everything is meant to run offline.

## What is already built

Shipped on `main`, in order:

1. Application shell (frameless window, sidebar, hash router)
2. Streaming chat against Ollama
3. AI core (provider seam, prompt builder, context window)
4. Conversation persistence
5. Personal memory (approval before anything is stored)
6. Tool planning (intent → plan → route)
7. Desktop automation (permission dialog, then real OS actions)
8. File workspace, document parsing, embeddings, retrieval, cited document chat
9. OCR, vision captions, image chat
10. Privacy page, activity timeline, appearance, AI settings, assistant persona

Routes: Chat, Chats, Files, Memory, Activity, Privacy, Settings.

## Point 1 — done (`668d5ee`)

Tools used to run **after** the reply, so the model never saw the result.

Now a command ("open Spotify", "remember my name is Asit") is planned
and executed while the reply is still waiting. The outcome is injected
by `formatToolOutcomes` (`src/automation/tool-outcome.ts`) into the
system prompt, and the model is told to confirm a success or admit a
failure or denial. Ordinary chat skips the planner (`COMMAND_HINT` in
`src/automation/automation.service.ts`). Stop during a permission
dialog cancels the rest of the plan. Regenerate does **not** run the
tool again. Remember / recall go through `MemoryExecutor`. An explicit
save suppresses the passive "should I remember this?" card for that turn.

## Point 2 — done (`59f0071`)

The Privacy page used to only store Allowed / Disabled. Nothing checked
the row, and `lastUsed` was never written.

Enforcement is `electron/permissions/permission.gate.ts`
(`assertPermission`, `recordPermissionUse`). It reads the same SQLite
rows the page writes. A refusal throws `PermissionDenied` with the
message from `permissionDeniedMessage` in `shared/permissions.ts`
("… is turned off in Privacy"). After a real use, last-used is stamped
and `permissions:used` is pushed so the page updates without a reload.

| Toggle | What it blocks | What still works |
| --- | --- | --- |
| Local AI | Chat, titles, intent detection, memory extraction, document retrieval (embeddings), vision analysis | Ollama health check |
| Documents | Parse, OCR, vision analysis, reading a cached vision analysis, document-chat retrieval | Listing and deleting files already in the workspace |
| Memory | Saving a memory, "always remember" rules, injecting memories into the prompt, the remember/recall tool, passive extraction | Memory page: list, search, edit, archive, delete |
| File System | Desktop file search, open, reveal, open folder | Adding a file to Luna's own workspace (the catalog text is about searching the computer) |
| Desktop Automation | Launch apps, open URLs, notes, reminders | — |
| Clipboard | Read, write, clear | — |
| Notifications | `notify()`, including a reminder that comes due (the reminder is marked sent and the toast is skipped) | — |

Chat shows the refusal in the error banner (`permission-disabled`).
A tool refusal is also in the tool-outcome prompt, so the reply can say
the action did not run. Document chat and image chat rethrow a privacy
refusal instead of quietly answering with no context. If the permission
database itself cannot be read, the gate fails open and logs it, so a
broken DB does not brick chat.

## Point 3 — done (`437b5cb`)

Settings → General and the sidebar identity used to be placeholders.

Launch on startup calls `app.setLoginItemSettings` from `electron/shell/shell.ts`. The choice is saved in the user-data directory next to `luna.db` (`shell.json`) and applied immediately, then again on the next launch. Default is off. An unpackaged run passes the app directory as the login-item argument (Vite starts Electron as `electron .`, so there is no main-script path on `argv`) so Windows does not start a bare Electron window; a packaged build registers `Luna.exe` with no extra arguments.

Minimize to tray defaults on. While it is on, closing the window hides Luna and leaves it running. The tray icon offers Show and Quit (a left click also shows the window). Quit, and closing while the switch is off, exit the app — that off path is the old behavior. The tray is created and removed as the switch changes, so it does not linger after the setting is turned off. If the icon cannot be created, close still quits, so the process cannot be stranded with no window and no tray. A second launch focuses the existing window instead of starting another process, including when Windows starts Luna at sign-in while it is already in the tray.

About reads `app.getVersion()` and no longer says "preview".

The sidebar shows the assistant name from personalization, falling back to "Luna", and that assistant's avatar. The hardcoded "Asit" and "Free plan" are gone.

## Point 4 — done

Long chats used to be truncated. `SlidingWindowContextManager` dropped the oldest turns once they exceeded the window.

`SummarizingContextManager` (`src/ai/context/summarizing-context-manager.ts`) implements `ContextManager`. When the conversation fits, it is returned unchanged and the model is not called. When it does not, the overflow is compressed into one summary message. The leading system prompt and the latest turn are always kept, and so are recent turns that still fit beside that summary.

`fitToWindow` is async. Its only caller is `beginStream` in `src/ai/conversation/conversation-manager.ts`, which awaits it. If the user stops or switches threads during the summary, the reply is not started.

The summary uses the existing Ollama provider (`AIProvider.generate`) and the live model from settings. There is no second provider. `createAiCore` in `src/ai/index.ts` constructs `SummarizingContextManager` with `SlidingWindowContextManager` as the fallback. A summary that throws, comes back empty, or still does not fit drops the overflow the old way, so a failed summary does not break the reply.

A summary is a model call, so the Local AI privacy toggle is read first (`permissionService.status("local-ai")`). When that toggle is off, the model is not called and the sliding window is used. If the status cannot be read, the check fails open, matching the main-process gate. The gate still refuses a call made while the toggle is off, and that failure falls back to the sliding window too.

## Next step

5. **Memory and the small productivity tools are unfinished.** This is the only task for the next agent. The prompt is at the bottom of this file.

## Still open after that

6. **Docs and tests lag the code.** `README.md` still describes only the shell and the chat engine. `docs/documents-architecture.md` and `docs/tool-architecture.md` still say embeddings and execution do not exist. There is no test suite; checks have been `tsc -b` plus small one-off scripts that are not kept in the repo. When tests are added, cover the privacy gate, the tool-outcome prompt, and the context summarizer. Do not invent a large framework.

Also not started, from `docs/ai-architecture.md`: voice, and any model provider besides Ollama.

Tool *definitions* in `src/ai/tools/registry/definitions.ts` are still `PlaceholderTool`. Real work is the executor registry in `src/automation/index.ts`. That split is intentional and already how the other tools run. Do not "fix" it by making `PlaceholderTool.execute` do the work.

## Where to look

- Chat loop: `src/ai/conversation/conversation-manager.ts` (`beginStream`)
- Tool run before the reply: `src/automation/automation.service.ts` (`resolveForReply`)
- Privacy gate: `electron/permissions/permission.gate.ts`
- Which automation call maps to which toggle: `electron/permissions/permission.policy.ts`
- Privacy UI: `src/pages/privacy/PrivacyPage.tsx`
- Shell (login item, tray, close-to-tray): `electron/shell/shell.ts`
- Settings page: `src/pages/settings/SettingsPage.tsx`
- Context window: `src/ai/context/context-manager.ts`, `src/ai/context/summarizing-context-manager.ts`, `src/ai/context/sliding-window.ts` (fallback)
- Where the context manager is chosen: `src/ai/index.ts` (`createAiCore`)
- Where the window is applied: `src/ai/conversation/conversation-manager.ts` (`beginStream`, the awaited `fitToWindow` call)
- Memory search: `electron/backend/db/memory-search.ts` (token overlap). Retrieval and `lastUsed` stamping: `electron/backend/db/memory.repository.ts`
- Memory page: `src/pages/memory/MemoryPage.tsx`
- Notes and reminders created from chat: `src/automation/notes/notes.executor.ts`, `src/automation/reminders/reminder.executor.ts`, `electron/automation/notes.ts`, `electron/automation/reminders.ts`

## Prompt for the next agent

Copy the block below into a new chat. Do not start step 6 in that session.

```
You are continuing Luna, a privacy-first offline desktop AI assistant. The repo is https://github.com/asitgiri1234/luna (local folder Documents/Luna, branch main). Read docs/project-status.md first and keep it updated when you finish.

Do only the next step below. Push it to GitHub when it works. Do not start the later steps.

## Already done (do not redo)

- Agent loop: tools run before the reply, and the model sees the outcome. Commit 668d5ee. Regenerate does not re-run tools. Tool classes in src/ai/tools/registry/definitions.ts are still PlaceholderTool on purpose. Real work is the executor registry in src/automation/index.ts. Do not move execution into PlaceholderTool.execute.
- Privacy toggles are enforced in electron/permissions/permission.gate.ts, and last-used is recorded. Commit 59f0071.
- Settings and sidebar identity. Commit 437b5cb. Launch on startup uses app.setLoginItemSettings and persists in %APPDATA%/Luna/shell.json (default off). An unpackaged login item must pass the app directory, because Vite starts Electron as "electron ." and argv has no main script. Minimize to tray defaults on: closing hides the window, and the tray offers Show and Quit. About shows app.getVersion(). The sidebar shows the assistant name from personalization, falling back to "Luna", and that avatar. Do not bring back a plan label.
- Long chats are summarized, not truncated. SummarizingContextManager in src/ai/context/summarizing-context-manager.ts implements ContextManager. When the conversation fits, it is left unchanged. When it does not, the overflow is one summary message. The system prompt and the latest turn are always kept. fitToWindow is async; the only caller is beginStream. The summary uses the existing Ollama provider. SlidingWindowContextManager stays as the fallback when the summary fails. If the Local AI privacy toggle is off, do not call the model for a summary. Do not add another model provider.

## Next step (this session)

Memory and the small productivity tools are unfinished.

1. Memory search is token overlap in electron/backend/db/memory-search.ts, not embeddings. Documents already embed locally through Ollama (electron/documents/embeddings/embedding.service.ts). Use that kind of local embedding behind the existing MemorySearchStrategy seam. Do not add a cloud embedding provider. Respect the Local AI and Memory privacy toggles.
2. confidence, lastUsed, and updatedAt are stored. lastUsed is stamped when a memory is retrieved (electron/backend/db/memory.repository.ts) but none of the three are used for decay. Stale, low-confidence memories should rank lower. Do not delete a memory the user has not archived.
3. There is no export. Add a local export of the user's memories from the Memory page (src/pages/memory/MemoryPage.tsx). Do not upload them.
4. Notes and reminders can be created from chat (src/automation/notes/notes.executor.ts, src/automation/reminders/reminder.executor.ts) and have no management screen. Add one so the user can see and remove them.
5. Typecheck with npx tsc -b. Update docs/project-status.md so this step is marked done and the list below is what remains. Commit and push to origin main.

## Remaining after that (do not build these now)

6. Docs and tests lag the code. README.md still describes only the shell and the chat engine. docs/documents-architecture.md and docs/tool-architecture.md still say embeddings and execution do not exist. There is no test suite. Bring the README and those two docs in line with the code. Add a small real test suite for the gate, the tool-outcome prompt, and the context summarizer. Do not invent a large framework.

Not started, and not part of this sequence unless asked: voice, and any model provider besides Ollama.
```
