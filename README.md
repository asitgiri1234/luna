# Luna

A premium desktop AI assistant powered by a local Ollama model.
Current milestones: the **application shell** (Electron + React +
TypeScript, Tailwind CSS v4, shadcn/ui, React Router, Framer Motion) and
the **AI chat engine** — a streaming, Markdown-rendering chat experience
with stop/regenerate/copy, running fully offline against Ollama.

## Tech stack

| Layer      | Technology                                  |
| ---------- | ------------------------------------------- |
| Desktop    | Electron (frameless window, secure preload) |
| UI         | React 19 + Vite 6 + TypeScript              |
| Styling    | Tailwind CSS v4 + shadcn/ui conventions     |
| Routing    | React Router (hash router)                  |
| Animation  | Framer Motion                               |
| AI         | Ollama (local, streaming over its HTTP API) |
| Storage    | SQLite (better-sqlite3) + Drizzle ORM       |
| Chat state | Zustand                                     |
| Markdown   | react-markdown + remark-gfm + Prism         |
| Packaging  | Electron Builder (Windows NSIS)             |

## Getting started

1. Install [Ollama](https://ollama.com/download) and pull the model:

   ```bash
   ollama pull qwen2.5:3b
   ```

   The model is configured in one place: `AI_MODEL` in `shared/ai.ts`.

2. Install and run Luna:

   ```bash
   npm install        # install dependencies (also rebuilds SQLite for Electron)
   npm run dev        # start Vite + Electron in development (HMR)
   npm run build      # typecheck + build renderer and electron bundles
   npm run dist:win   # build + package a Windows installer into release/
   npm run db:generate  # regenerate SQL migrations after editing the schema
   ```

Conversations are stored locally in SQLite (`%APPDATA%/luna/luna.db`);
migrations in `drizzle/` are applied automatically at app startup.

## Architecture

Full reference: [docs/ai-architecture.md](docs/ai-architecture.md).

Chat data flows one way, and no layer skips a level:

```
React components → chat store (zustand adapter) → ConversationManager
  → AIProvider (interface) → preload bridge → IPC → AiController
  → provider registry → OllamaMainProvider → Ollama HTTP API
```

- `electron/main.ts` — main process: window lifecycle, window-control IPC.
- `electron/preload.ts` — the only bridge into the renderer (`window.luna`),
  kept minimal and typed.
- `src/ai/` — the renderer AI core: `AIProvider` interface + factory,
  model registry, prompt builder, context manager, conversation state
  machine, config, and the composition root that wires them (DI).
- `electron/backend/providers/` — main-process providers behind a
  registry; the Ollama provider owns NDJSON streaming, watchdog
  timeouts, and error classification.
- `electron/controllers/` + `electron/ipc/` — one controller per domain,
  registered on typed channels defined in `shared/ai.ts`.
- `shared/` — the IPC contract and the structured logger, shared by
  both TypeScript projects.
- `src/services/` — renderer-side wrappers around non-AI boundaries
  (window controls). Components never touch `window.luna` directly.
- `src/store/chat/` — thin zustand adapter over the conversation
  manager; no business logic.
- `src/layouts/` — reusable shell chrome (`AppLayout`, `PageContainer`).
- `src/pages/<feature>/` — feature-based screens; each feature owns its
  page and its private components.
- `src/components/ui/` — shadcn/ui primitives; `src/components/` for
  shared app components (title bar, sidebar).
- `src/store/` — reserved for global state (empty by design in this
  milestone).

## Project structure

```
electron/
  backend/
    db/           # Drizzle schema, SQLite client, conversation + memory repos
    providers/    # MainAiProvider interface, Ollama impl, registry
  controllers/    # AI, conversations, memory controllers
  ipc/            # channel registration per domain
  main.ts         # main-process composition root
  preload.ts
drizzle/          # generated SQL migrations (applied at startup)
shared/           # IPC contracts + structured logger (main + renderer)
docs/             # architecture documentation
src/
  ai/             # AI core: provider/, models/, prompt/, context/,
                  # conversation/, memory/, tools/, config/, errors/, types/, index.ts (DI root)
  assets/
  components/
    chat/         # message list, bubbles, markdown, code blocks, errors
    sidebar/
    titlebar/
    ui/
  hooks/
  layouts/
  lib/
  pages/
    chat/
    history/
    memory/
    settings/
  services/       # non-AI boundaries (window controls)
  store/
    chat/           # active thread — thin adapter over the conversation manager
    conversations/  # saved-conversation catalog for sidebar/history
    memory/         # approval candidates + saved-memory catalog
  types/
```

The Personal Memory Engine (privacy-first, approval-gated) is documented
in [docs/memory-architecture.md](docs/memory-architecture.md). The Tool
Calling Framework (planning + routing only, no execution) is documented
in [docs/tool-architecture.md](docs/tool-architecture.md).
