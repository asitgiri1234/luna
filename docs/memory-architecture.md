# Luna — Personal Memory Engine

> Milestone 5. Privacy-first: nothing is remembered without the user's
> explicit approval (or a standing "always" rule they created), and
> everything remembered is visible, editable, and deletable on the
> Memory page.

## 1. Folder structure

```
shared/memory.ts                          # wire contract: categories, records,
                                          # candidates, rules, channels
electron/backend/db/
  schema.ts                               # + memories, memory_rules tables
  memory.repository.ts                    # the ONLY module that queries memory
  memory-search.ts                        # embedding-free MemorySearchStrategy
electron/controllers/memory.controller.ts # repo calls → DbResult envelopes
electron/ipc/memory.ipc.ts                # memory:* invoke channels
drizzle/0001_memory.sql                   # generated migration

src/ai/memory/
  memory-repository.ts                    # renderer repository interface (seam)
  ipc-memory-repository.ts                # pure-transport IPC implementation
  memory-extractor.ts                     # LLM → structured MemoryCandidate[]
  memory-service.ts                       # orchestration façade + events + port
src/store/memory/memory.store.ts          # candidates + catalog for the UI
src/lib/memory-categories.tsx             # category labels / icons / tints
src/components/memory/
  MemoryApprovalCard.tsx / MemoryApprovalStack.tsx   # "Luna would like to remember"
  MemoryCard.tsx                          # one saved memory (edit/archive/delete)
src/pages/memory/MemoryPage.tsx           # grouped, searchable, filterable page
```

## 2. Memory flow

```
User message
   │  (after the assistant reply completes — never competes with streaming)
   ▼
MemoryExtractor            LLM → strict JSON → MemoryCandidate[]  (proposes only)
   │
   ▼
MemoryService.mineCandidates
   │  repository.classifyCandidate(candidate)  ← user's standing rules
   ├── "never"  → dropped silently
   ├── "always" → saved without prompting
   └── "ask"    → emitted as a candidate
                     │
                     ▼
             MemoryApprovalCard   "Luna would like to remember"
             Remember · Ignore · Always similar · Never similar
                     │  (only Remember / Always persists)
                     ▼
             MemoryService.approve → MemoryRepository.saveMemory → SQLite

Before generating a reply:
   ConversationManager.beginStream
     → MemoryService.getRelevantMemories(userText)   (relevance-gated)
     → PromptBuilder.build({ history, memory })       (injected into system prompt)
     → provider.stream(...)
```

## 3. Repository design

- **One data-access module** (`memory.repository.ts`) runs every query;
  the controller wraps results in `DbResult`; the renderer talks only to
  the `MemoryRepository` interface. No SQL touches React.
- **Methods**: `saveMemory`, `updateMemory`, `archiveMemory`,
  `deleteMemory`, `searchMemories`, `listMemories`,
  `getRelevantMemories`, plus `addRule` / `classifyCandidate` for the
  always/never rules.
- **Duplicate handling**: `saveMemory` compares the candidate to existing
  memories in the same category by token similarity; above a threshold it
  merges (updates value + confidence) instead of inserting.
- **Corrupt data**: a row with an unrecognized category degrades to
  `custom` rather than being dropped, so a bad value never hides a memory.
- **Search** is an injected `MemorySearchStrategy` (default: token
  overlap, no embeddings). `getRelevantMemories` ranks active memories,
  keeps those above a relevance threshold, and bumps their `lastUsed`.

## 4. Prompt integration

`PromptBuilder.build({ history, memory })` already reserved a `memory`
slot (milestone 3). The conversation manager now fills it: right before
streaming, it calls `MemoryService.getRelevantMemories(latestUserText)`,
which returns only the values scoring above the relevance threshold.
Those are rendered into the system prompt under
"Things you remember about the user". Unrelated memories score 0 and are
never injected — verified: a query sharing vocabulary with a memory
retrieves it; an unrelated query retrieves nothing.

## 5. Future extension points

- **Embedding search** — implement `MemorySearchStrategy` with vectors
  from a local model; swap it into the repository. Nothing else changes.
  (This is the natural upgrade from today's token-overlap heuristic,
  which only matches on shared vocabulary.)
- **Automatic decay / confidence** — `confidence`, `lastUsed`, and
  `updatedAt` are stored to support future forgetting or re-ranking.
- **Memory-aware tools** — the tool-calling milestone can expose
  `MemoryRepository` methods as tools (recall/save) behind the same
  interface.
- **Provenance** — `sourceConversationId` links a memory to its origin
  conversation (nulled, not deleted, when that conversation is removed).
- **Richer rules** — `memory_rules` currently stores token bags; it can
  grow structured conditions without touching callers.
- **Sync / export** — because all memory lives in SQLite behind one
  repository, export/import or encrypted sync is an additive feature.
```
