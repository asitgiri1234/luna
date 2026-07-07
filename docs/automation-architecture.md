# Luna — Desktop Automation Engine

> Milestone 7. Turns the planning-only Tool Framework (Milestone 6) into
> real, permission-gated execution. Everything runs locally. Execution
> always flows through the Tool Router — the framework is never bypassed.

## 1. Folder structure

OS operations must run in the main process (Node has `child_process`,
`fs`, `clipboard`, `Notification`); the renderer is sandboxed. So the
engine and executors live in `src/automation/` (orchestration) and
delegate the actual OS calls over IPC to `electron/automation/`.

```
src/automation/
  executor/
    types.ts                 # ToolExecutor, ExecutionCard, PermissionDecision
    executor-registry.ts     # name → ToolExecutor
    execution-engine.ts      # the generic engine (validate→permission→execute→log)
  permission/
    permission-manager.ts    # permission gate; remembered choices (localStorage)
  applications/launch-application.executor.ts
  filesystem/search-files.executor.ts   # SearchFiles + Document (open) executors
  notes/notes.executor.ts
  clipboard/clipboard.executor.ts
  browser/browser.executor.ts
  calculator/
    calculator.executor.ts
    safe-eval.ts             # tokenizer + shunting-yard (no eval/Function)
  reminders/
    reminder.executor.ts
    time-parser.ts           # "tomorrow 5 PM" → timestamp
  notifications/notification.service.ts
  windows/window.service.ts  # window-management seam (focus handled at launch)
  os-bridge.ts               # single accessor for the main-process automation API
  automation.service.ts      # façade: run(message) = plan (M6) + execute
  index.ts                   # composition root: createAutomationSystem()

electron/automation/         # main process — the actual OS work
  applications.ts  files.ts  system.ts  notes.ts  reminders.ts
electron/controllers/automation.controller.ts   # AutomationResult envelopes + logging
electron/ipc/automation.ipc.ts                   # automation:* channels

src/store/automation/automation.store.ts         # cards + pending prompts for the UI
src/components/automation/                        # PermissionDialog, ExecutionCard(Stack)
```

## 2. Execution flow

```
Conversation (or window.lunaAgent.run)
   ↓
ToolPlanningService.plan()        ← Milestone 6: IntentDetector → Planner → ToolRouter
   ↓  ExecutionRequest (routed steps + permission requests)
ExecutionEngine.run()
   ↓  per step, in dependency order:
   1. check the router's validation
   2. resolve upstream data (plan bindings: search → open)
   3. PermissionManager.request()  ─── awaits the Permission Dialog
   4. ToolExecutor.execute()       ─── only if approved
   5. OS-bridge → IPC → electron/automation/* → Operating System
   6. emit ExecutionCard + log (tool, args, ms, outcome)
   ↓
ToolResult (success | failed | cancelled | permission-required)
```

The engine is generic: it never knows a specific tool, only the
`ToolExecutor` interface resolved from the registry.

## 3. Permission flow

```
routed step needs permission?
   ├─ remembered "allow"  → auto-approve
   ├─ remembered "deny"   → auto-deny
   └─ otherwise → raise PendingPermission → Permission Dialog
                     ├─ Approve  → execute (optionally remember)
                     ├─ Deny     → card "denied", tool never runs (optionally remember)
                     └─ Cancel   → card "cancelled"
```

- Nothing executes without an approved decision. Reading the clipboard,
  launching apps, file access, notifications — all gated.
- "Remember my choice" persists per-tool in `localStorage`, so repeated
  actions don't nag; it can be cleared later from settings.
- The dialog shows the tool, the reason, the exact permissions, and the
  arguments, so the user always knows what they're approving.

## 4. Dependency graph

```
                Conversation / window.lunaAgent.run
                              │
                    AutomationService (façade)
                    │                     │
        ToolPlanningService (M6)     ExecutionEngine
        (plan + route, unchanged)    │        │
                                ExecutorRegistry  PermissionManager
                                     │                 │
                         ToolExecutor (per tool)   Permission Dialog (UI)
                                     │
                                 os-bridge → IPC → electron/automation/* → OS
```

The engine, registry, and permission manager depend only on interfaces.
No executor is imported by the engine; no React component contains OS or
execution logic (it all goes through the store → managers).

## 5. Adding a new tool

Three self-contained additions, no existing file changes:

1. **Definition (planning)** — add a `Tool` to the Milestone 6 registry
   (`src/ai/tools/registry/definitions.ts`): metadata, parameters,
   `permissionsRequired`. The planner/router pick it up automatically.
2. **Executor (doing)** — implement `ToolExecutor` in
   `src/automation/<category>/` and register it in
   `createExecutorRegistry()` under the same `name`.
3. **OS capability (if needed)** — add a function in
   `electron/automation/*`, a channel in `shared/automation.ts`, and a
   handler in `automation.ipc.ts`.

The permission dialog, execution engine, cards, and logging work for the
new tool with no further changes.

## 6. Error handling

Every failure mode degrades to a `failed`/`denied` card with a friendly
message, never a crash:

| Case | Handling |
| --- | --- |
| Application not found / unknown | classified `app-not-found` / `app-unknown` error → card detail |
| Permission denied | card `denied`; executor never called |
| File missing | `assertExists` → `file-missing` before open/reveal |
| Notification failure | caught in the reminder scheduler; scheduling continues |
| Clipboard unavailable | `clipboard-unavailable` → friendly card |
| Bad math expression | safe evaluator throws → `failed` with the parse error |
| Unparseable / past reminder time | validated in the executor → friendly failure |

## 7. Testing strategy

- **Unit-friendly, pure logic**: `safe-eval.ts` (arithmetic, precedence,
  functions, div-by-zero) and `time-parser.ts` (relative/absolute times)
  are pure functions with no IPC — ideal for unit tests.
- **Injectable seams**: the `ExecutorRegistry` and `PermissionManager`
  are constructor-injected, so the engine can be driven in tests with a
  fake executor and an auto-approving permission manager.
- **Diagnostic hooks**: `window.lunaAgent.debug.cards()` /
  `.pending()` expose live engine + permission state for integration
  tests without touching internals.
- **End-to-end (this milestone, over CDP)**: verified the full chain on
  the real app — calculator (no permission), clipboard write
  (approve → verified by reading it back), file search, reminder, and a
  Notepad launch, plus the **deny** path (card `denied`, tool never
  ran). The permission dialog was driven through the real UI.
```
