# Luna

A premium desktop AI assistant. This repository currently contains the
**application shell** (foundation milestone): Electron + React + TypeScript,
Tailwind CSS v4, shadcn/ui, React Router, and Framer Motion — no AI,
backend, or automation logic yet.

## Tech stack

| Layer      | Technology                                  |
| ---------- | ------------------------------------------- |
| Desktop    | Electron (frameless window, secure preload) |
| UI         | React 19 + Vite 6 + TypeScript              |
| Styling    | Tailwind CSS v4 + shadcn/ui conventions     |
| Routing    | React Router (hash router)                  |
| Animation  | Framer Motion                               |
| Packaging  | Electron Builder (Windows NSIS)             |

## Getting started

```bash
npm install        # install dependencies
npm run dev        # start Vite + Electron in development (HMR)
npm run build      # typecheck + build renderer and electron bundles
npm run dist:win   # build + package a Windows installer into release/
```

## Architecture

- `electron/main.ts` — main process: window lifecycle, window-control IPC.
- `electron/preload.ts` — the only bridge into the renderer (`window.luna`),
  kept minimal and typed.
- `src/services/` — renderer-side wrappers around external boundaries
  (IPC today; AI/backend clients later). Components never touch
  `window.luna` directly.
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
  main.ts
  preload.ts
src/
  assets/
  components/
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
  store/
  types/
```
