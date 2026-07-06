# Luna — AI Core Architecture

> Milestone 3. This document is the reference for every future AI
> feature (memory, tool calling, desktop automation, file
> understanding, vision, voice, multiple providers). If a change
> doesn't fit one of the extension points below, discuss the
> architecture first.

## 1. Folder structure

```
shared/                     # crosses the IPC boundary — no side-specific imports
  ai.ts                     # wire types, AiError taxonomy, channels
  logger.ts                 # structured logger (both processes)

electron/                   # main process ("backend")
  backend/providers/
    provider.ts             # MainAiProvider interface
    ollama.provider.ts      # the ONLY module that talks to Ollama
    registry.ts             # providerId → MainAiProvider
  controllers/ai.controller.ts  # orchestrates streams, cancel, health
  ipc/ai.ipc.ts             # binds ai:* channels to the controller
  main.ts                   # main-process composition root

src/ai/                     # renderer AI core (framework-free, no React)
  index.ts                  # composition root: createAiCore() + aiCore
  types/                    # domain types (re-exports wire types)
  errors/ai-error.ts        # centralized error layer (re-exports AiError)
  config/ai.config.ts       # AiConfig + defaultAiConfig (single tuning point)
  models/model-registry.ts  # model catalog: context length, vision, defaults
  provider/
    ai-provider.ts          # AIProvider interface — THE seam
    ollama.provider.ts      # IPC-backed implementation
    provider-factory.ts     # providerId → AIProvider
  prompt/prompt-builder.ts  # assembles system + memory + history
  context/
    context-manager.ts      # interface: token estimation, window fitting
    sliding-window.ts       # baseline implementation
  conversation/conversation-manager.ts  # send/stop/regenerate state machine

src/store/chat/chat.store.ts  # thin zustand adapter (no business logic)
src/components/, src/pages/   # render-only UI (unchanged by this milestone)
```

## 2. Dependency graph

Arrows point at dependencies. React never sees anything below the
store; nothing below the factory sees a concrete provider.

```
React components
      │
      ▼
chat.store (zustand adapter)
      │
      ▼
ConversationManager ───→ PromptBuilder
      │            ───→ ContextManager (SlidingWindow impl)
      │            ───→ ModelRegistry
      ▼
AIProvider (interface)  ←─ injected by composition root (src/ai/index.ts)
      ▲
      │ implements
OllamaProvider (renderer) ──→ window.luna.ai (preload bridge)
                                   │  IPC (ai:* channels, shared/ai.ts)
                                   ▼
                          AiController (main)
                                   │
                                   ▼
                          ProviderRegistry ──→ MainAiProvider (interface)
                                                     ▲
                                                     │ implements
                                          OllamaMainProvider ──→ Ollama HTTP API
```

Cross-cutting: `shared/ai.ts` (contract), `shared/logger.ts`
(structured logging), `src/ai/errors` (error taxonomy).

## 3. Module responsibilities

| Module | Responsibility | Must NOT do |
| --- | --- | --- |
| `shared/ai.ts` | Wire types, `AiError` + codes, channel names | Anything provider-specific |
| `shared/logger.ts` | Structured, scoped, leveled logging | Transport/persistence (add sinks later) |
| `src/ai/index.ts` | Composition root; the only `new`/factory site | Business logic |
| `provider/ai-provider.ts` | The `AIProvider` seam: `generate`, `stream`, `cancel`, `healthCheck` | — |
| `provider/ollama.provider.ts` | Forward requests over the injected IPC bridge | Speak the Ollama protocol |
| `provider/provider-factory.ts` | Map `providerId` → concrete provider | Leak concrete types upward |
| `models/model-registry.ts` | Catalog of models + capabilities | Decide the current model (config does) |
| `prompt/prompt-builder.ts` | Assemble final prompt (system + memory slot + history) | Live in React; trim context |
| `context/*` | Token estimation, window fitting, future summarization | Know about providers or UI |
| `conversation/conversation-manager.ts` | Conversation state machine, stream consumption, token batching | Import React/zustand/concrete providers |
| `config/ai.config.ts` | All tunables: provider, model, sampling, system prompt, streaming | — |
| `errors/ai-error.ts` | Single error taxonomy + helpers | Contain UI copy |
| `store/chat/chat.store.ts` | Mirror manager state for React selectors | Business logic |
| `electron/backend/providers/*` | Real runtime communication (HTTP), error classification, timeouts | Be imported by anything except the registry |
| `electron/controllers/ai.controller.ts` | Route requests, pump events, track cancellation | Know concrete providers |
| `electron/ipc/ai.ipc.ts` | Channel ↔ controller binding | Logic |

## 4. Future extension points

- **Memory** — retrieve facts, pass them as `memory` to
  `PromptBuilder.build` (parameter already exists). Storage/retrieval
  is a new `src/ai/memory/` module wired in the composition root.
- **Tool calling** — extend `AiStreamEvent` with a `tool-call` variant
  in `shared/ai.ts`; the conversation manager grows a tool-execution
  step; providers that support tools emit the new event.
- **Desktop automation** — a new main-process controller + IPC domain
  (`automation:*`) consumed as tools; nothing in the AI core changes.
- **File understanding / Vision** — `ModelInfo.supportsVision` already
  gates it; extend `AiChatMessage` with optional attachments in
  `shared/ai.ts` and let providers translate them.
- **Voice** — a renderer service producing text into
  `ConversationManager.send()`; TTS subscribes to snapshots.
- **New provider** — implement `MainAiProvider` + register
  (main), implement `AIProvider` or reuse the IPC pattern + add a
  factory case (renderer), add models to the registry. No other module
  changes.
- **Summarization** — new `ContextManager` implementation; swap it in
  the composition root.
- **Persistence / multiple chats** — one `ConversationManager` per
  thread; a persistence service subscribes to snapshots and hydrates
  managers on startup.
- **Settings UI** — write user overrides on top of `defaultAiConfig`
  and rebuild the core via `createAiCore({ config })`.
- **Testing** — `createAiCore({ provider: fakeProvider })` runs the
  whole conversation pipeline against a scripted provider.
```
