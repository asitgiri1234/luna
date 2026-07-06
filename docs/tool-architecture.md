# Luna — Tool Calling Framework

> Milestone 6. **Planning and routing only.** Nothing executes: every
> tool is a placeholder, and the pipeline stops at an
> `ExecutionRequest` annotated with permission requests. A later
> milestone adds the approval UI and the executor.

## 1. Folder structure

The framework lives under `src/ai/tools/` (matching the codebase's
`src/ai/` convention). The milestone's requested folders map to its
subfolders:

```
src/ai/tools/
  types/                    # Tool, ToolResult, PermissionRequest, Intent, Plan,
                            # ExecutionRequest (+ barrel)
  registry/
    placeholder-tool.ts     # base class: generic validate + non-executing execute
    definitions.ts          # the 9 placeholder tools + createDefaultTools()
    tool-registry.ts        # ToolRegistry (register / get / list / byCategory)
  intent/
    intent-detector.ts      # LLM → structured IntentDetectionResult
  planner/
    planner.ts              # intents → ExecutionPlan (deterministic, data-flow chaining)
  router/
    tool-router.ts          # ExecutionPlan → ExecutionRequest (resolve, validate, permissions)
  permission/
    permission-layer.ts     # Tool → PermissionRequest (never auto-executes)
  tool-planning.service.ts  # façade: plan() runs the whole pipeline + logs
  index.ts                  # createToolSystem() composition root
```

Wired into `src/ai/index.ts` (`aiCore.tools`) and exposed as
`window.lunaAgent.plan()` / `.listTools()` — the stable hook the future
executor, agent UI, and integration tests consume.

## 2. Dependency graph

```
                 Conversation / any caller
                          │
                          ▼
                 window.lunaAgent.plan(message)
                          │
                          ▼
                 ToolPlanningService            ← logs every decision
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
  IntentDetector  →   Planner    →      ToolRouter
   (LLM + registry)  (registry)   (registry + PermissionLayer)
        │                 │                  │
        └── ToolRegistry ─┴──────────────────┘
                          │
                          ▼
                   ExecutionRequest   (plan + routed steps + permission requests)
                          │
                          ▼
                 [ future executor + approval UI ]   ← not in this milestone
```

Arrows point at dependencies. Nothing imports a concrete tool: the
detector, planner, and router resolve tools through `ToolRegistry`
only. The provider is the same injected `AIProvider` the rest of the AI
core uses (Ollama over IPC).

## 3. The pipeline

1. **IntentDetector** — one LLM call over the message + the registry's
   tool catalog. Returns strict JSON: `requiresTools`, an ordered list
   of `intents` (tool + extracted parameters + confidence + reasoning),
   and overall confidence. Hallucinated tool names are dropped;
   malformed output degrades to "ordinary chat, no tools". This is also
   where **parameter extraction** happens ("Open Spotify" →
   `{application: "Spotify"}`).
2. **Planner** — deterministic. Maps intents to ordered `PlanStep`s and
   chains them by **data flow**: when a step's tool `accepts` a data
   kind an earlier step `produces`, it records a `dependsOn` edge and a
   parameter **binding**. That is how "find my resume and open it"
   becomes `search_files → document` with the document's `path` bound to
   the search result (verified).
3. **PermissionLayer** — builds a `PermissionRequest` for every tool
   that needs permissions. Tools needing none (the calculator) yield no
   request but are still never executed here.
4. **ToolRouter** — resolves each step's tool, validates its parameters
   (bound parameters count as satisfied; `canExecute` gates
   availability), attaches permission requests, and produces the final
   `ExecutionRequest` with an outcome of `ready`, `invalid`, or
   `no-tools`. It never calls `execute()`.

**Result types**: `ToolResult` has four states — `success`, `failed`,
`cancelled`, `permission-required`. Placeholder `execute()` only ever
returns `permission-required`.

## 4. How future tools plug in

Adding a tool is self-contained — the planner, router, and detector need
no changes:

```ts
export class WeatherTool extends PlaceholderTool {
  readonly name = "weather";
  readonly description = "Get the current weather for a location.";
  readonly category: ToolCategory = "web";
  readonly parameters = [
    { name: "location", type: "string", description: "City or place.", required: true },
  ];
  readonly permissionsRequired: Permission[] = ["network"];
}
```

Then register it — either add it to `createDefaultTools()`, or at
runtime: `aiCore.tools.registry.register(new WeatherTool())`. The
detector's catalog, the planner, and the router pick it up
automatically.

To make a tool actually run (next milestone): override `execute()` to do
the work behind a granted permission, and returning `toolSuccess(...)` /
`toolFailed(...)`. The interface and every upstream component stay the
same.

## 5. Future extension points

- **Executor + approval UI** — consume `ExecutionRequest`: render each
  `PermissionRequest` for approval, then run granted steps in dependency
  order, passing each step's result into the next via its `bindings`.
- **Live conversation integration** — run `plan()` on the user message
  (like memory extraction, after the reply) and surface the
  `ExecutionRequest` as an action card. The seam exists; it is
  intentionally not wired into streaming yet.
- **Richer planning** — branching, fan-out, or LLM-proposed bindings go
  in the `Planner` without touching tools or the router.
- **Permission policies** — "always allow the calculator", "never allow
  file writes" slot into `PermissionLayer.requiresApproval`.
- **Tool discovery / plugins** — because the registry accepts any `Tool`
  at runtime, third-party or dynamically loaded tools join without core
  changes.
- **Result streaming** — long-running tools can report progress by
  extending `ToolResult`; the four-state contract already anticipates
  async outcomes.
```
