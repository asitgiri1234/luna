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
   npm install        # install dependencies
   npm run dev        # start Vite + Electron in development (HMR)
   npm run build      # typecheck + build renderer and electron bundles
   npm run dist:win   # build + package a Windows installer into release/
   ```

## Architecture

Chat data flows one way, and no layer skips a level:

```
React components → chat store (zustand) → AI service → preload bridge
  → IPC → chat controller (main process) → Ollama client → Ollama HTTP API
```

- `electron/main.ts` — main process: window lifecycle, window-control IPC.
- `electron/preload.ts` — the only bridge into the renderer (`window.luna`),
  kept minimal and typed.
- `electron/backend/` — Ollama client: NDJSON streaming, watchdog
  timeouts, error classification (not installed / not running / model
  missing / timeout).
- `electron/controllers/` + `electron/ipc/` — one controller per domain,
  registered on typed channels defined in `shared/ai.ts`.
- `shared/` — the IPC contract (types, channels, model constant) shared
  by both TypeScript projects.
- `src/services/` — renderer-side wrappers around external boundaries
  (window controls, AI streaming). Components never touch
  `window.luna` directly.
- `src/store/chat/` — conversation state machine (idle → waiting →
  streaming → stopping) with frame-aligned token batching.
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
  backend/        # Ollama client
  controllers/    # generation orchestration per domain
  ipc/            # channel registration
  main.ts
  preload.ts
shared/           # IPC contract shared by main + renderer
src/
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
  services/
    ai/           # renderer-side streaming service
  store/
    chat/         # conversation state machine
  types/
```
