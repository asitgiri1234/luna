# Luna — project status

Handoff for the next agent. The GitHub repo is
[asitgiri1234/luna](https://github.com/asitgiri1234/luna). The local
folder `Documents/Luna` tracks `origin/main`.

Luna is a privacy-first desktop AI assistant. Electron + React 19 +
TypeScript, Tailwind, a local Ollama model, and SQLite (Drizzle) under
`%APPDATA%/luna/luna.db`. Everything is meant to run offline.

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

## Point 3 — done (this change)

Settings → General and the sidebar identity used to be placeholders.

Launch on startup calls `app.setLoginItemSettings` from `electron/shell/shell.ts`. The choice is saved in the user-data directory next to `luna.db` (`shell.json`) and applied immediately, then again on the next launch. Default is off. An unpackaged run passes the app directory as the login-item argument (Vite starts Electron as `electron .`, so there is no main-script path on `argv`) so Windows does not start a bare Electron window; a packaged build registers `Luna.exe` with no extra arguments.

Minimize to tray defaults on. While it is on, closing the window hides Luna and leaves it running. The tray icon offers Show and Quit (a left click also shows the window). Quit, and closing while the switch is off, exit the app — that off path is the old behavior. The tray is created and removed as the switch changes, so it does not linger after the setting is turned off. If the icon cannot be created, close still quits, so the process cannot be stranded with no window and no tray. A second launch focuses the existing window instead of starting another process, including when Windows starts Luna at sign-in while it is already in the tray.

About reads `app.getVersion()` and no longer says "preview".

The sidebar shows the assistant name from personalization, falling back to "Luna", and that assistant's avatar. The hardcoded "Asit" and "Free plan" are gone.

## Still open

4. **Long chats are truncated, not summarized.** `SlidingWindowContextManager` drops old messages. The planned summarizer was never added.

5. **Memory search is keyword overlap**, not embeddings. No confidence decay. No export. Notes and reminders can be created from chat and have no management screen.

6. **Docs and tests lag the code.** `README.md` still describes only the shell and chat. `docs/documents-architecture.md` and `docs/tool-architecture.md` still say embeddings and execution do not exist. There is no test suite; checks have been `tsc -b` plus small one-off scripts that are not kept in the repo.

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
