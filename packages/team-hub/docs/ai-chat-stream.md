# AI chat stream protocol

HarborClient AI assistant turns use a versioned JSON event stream for live UI updates. The wire contract lives in `@harborclient/core` as `AiChatStreamEvent` (`packages/core/src/types/aiChatStream.ts`). Team Hub emits a subset of these events over Server-Sent Events (SSE) from `POST /llm/chat/stream`. The desktop app adds renderer-scoped events over IPC (`aiChat:stream`) after orchestrating client-side tools.

## Wire format

Every event is a single JSON object on one SSE `data:` line (see [POST /llm/chat/stream](./endpoints.md#post-llmchatstream)).

| Field | Type | Description |
| ----- | ---- | ----------- |
| `v` | `1` | Schema version (`AI_CHAT_STREAM_EVENT_VERSION`). Clients reject unknown versions. |
| `type` | string | Event discriminant (see catalog below). |
| `turnId` | string | Stable id for one user send through renderer orchestration (max 128 chars). |
| `stepIndex` | number | Zero-based renderer outer-loop index for the active `completeChatStep` invoke. Present on step-scoped events only. |

Optional nested objects:

- **`usage`** — `{ promptTokens?, completionTokens?, totalTokens? }` on `step.end` and `turn.end`.
- **`iteration`** — `{ hitIterationLimit?, boundary? }` where `boundary` is `renderer_outer` or `hub_inner`.

## Event catalog

### `turn.start`

Renderer-only (desktop IPC). Marks the beginning of one user send.

| Field | Type | Required |
| ----- | ---- | -------- |
| `model` | string | Yes |
| `hubId` | string | No |

Team Hub does not emit this event.

### `step.start`

Marks the beginning of one renderer outer-loop step (one Hub stream invoke).

| Field | Type | Required |
| ----- | ---- | -------- |
| `stepIndex` | number | Yes |

Team Hub emits this as the first frame after the SSE connection opens.

### `delta.text`

Incremental assistant text for the active step.

| Field | Type | Required |
| ----- | ---- | -------- |
| `stepIndex` | number | Yes |
| `chunk` | string | Yes (non-empty, max 65 536 chars) |

Team Hub emits one chunk per provider text delta during the inner agent loop.

### `delta.thought`

Incremental ephemeral reasoning text for the active step. Same shape as `delta.text` (`stepIndex`, `chunk`).

Thought deltas are **live UI only** — they are not persisted to SQLite chat history. The event type is part of the v1 contract so clients can render reasoning when a runtime emits it. **Team Hub does not currently emit `delta.thought`** on `POST /llm/chat/stream`; only `delta.text` is streamed from the hub today.

### `tool.call`

Announces a tool call at a step completion boundary.

| Field | Type | Required |
| ----- | ---- | -------- |
| `stepIndex` | number | Yes |
| `callId` | string | Yes |
| `name` | string | Yes |
| `owner` | `'harbor'` \| `'hub'` | Yes |
| `arguments` | string | Yes (JSON arguments, max 65 536 chars) |

See [Tool ownership](#tool-ownership) below.

### `tool.result`

Progress row for a completed tool execution (live UI).

| Field | Type | Required |
| ----- | ---- | -------- |
| `stepIndex` | number | Yes |
| `callId` | string | Yes |
| `name` | string | Yes |
| `owner` | `'harbor'` \| `'hub'` \| `'renderer'` | Yes |
| `summary` | string | Yes (max 2 048 chars) |
| `ok` | boolean | No |

Team Hub emits `tool.result` with `owner: 'hub'` after hub-native and MCP tools finish. The desktop emits `owner: 'renderer'` for locally executed Harbor tools over IPC.

### `step.end`

Terminal event for **one Hub agent step** (one renderer `completeChatStep` invoke). Carries the same payload shape as the JSON `POST /llm/chat/step` response.

| Field | Type | Required |
| ----- | ---- | -------- |
| `stepIndex` | number | Yes |
| `content` | string \| null | Yes |
| `toolCalls` | array | No (passthrough Harbor tool calls) |
| `usage` | object | No |
| `iteration` | object | No |

`chatStepResultFromStepEnd()` in `@harborclient/core` reconstructs a `ChatStepResult` from this event.

**Important:** `step.end` completes a single Hub step, not the full user turn. The renderer may invoke multiple steps (tool loop) before emitting `turn.end`.

### `turn.awaiting_user`

Renderer-only. Turn paused waiting for an answer to `ask_user`.

| Field | Type | Required |
| ----- | ---- | -------- |
| `toolCallId` | string | Yes |
| `question` | string | Yes |
| `choices` | string[] | No |

Persisted as `PendingAiChatTurn` for crash recovery.

### `turn.end`

Renderer-only terminal success for the full user turn.

| Field | Type | Required |
| ----- | ---- | -------- |
| `content` | string \| null | No |
| `usage` | object | No |
| `iteration` | object | No |

Emitted after the renderer outer tool loop finishes (including iteration-limit paths). Team Hub never emits `turn.end` on the SSE wire.

### `turn.error`

Terminal failure.

| Field | Type | Required |
| ----- | ---- | -------- |
| `message` | string | Yes (max 4 096 chars) |

Team Hub may emit this on the SSE stream when the step fails after headers are sent. The renderer emits it for local orchestration failures.

### `turn.cancelled`

Terminal cancellation. No additional fields.

Team Hub emits this when the client disconnects or upstream work is aborted (`AbortError`). The renderer emits it when the user cancels a turn locally.

## Terminal semantics

```text
User message
  └─ turn.start                    (renderer)
       └─ step 0..N                (renderer outer loop, max 8)
            ├─ POST /llm/chat/stream (hub)
            │    ├─ step.start
            │    ├─ delta.text / tool.*  (hub inner loop, max 8)
            │    └─ step.end             ← Hub stream ends here
            ├─ execute Harbor tools      (renderer)
            └─ …
       ├─ turn.awaiting_user       (renderer, ask_user pause)
       ├─ turn.end                  (renderer, success)
       ├─ turn.error                (renderer or hub)
       └─ turn.cancelled            (renderer or hub)
```

Hub `step.end` ≠ renderer `turn.end`. Consumers of `POST /llm/chat/stream` must treat `step.end` as the successful completion of one invoke; full-turn lifecycle events are owned by the desktop orchestrator.

## Tool ownership

| `owner` | Executes on | Examples |
| ------- | ----------- | -------- |
| `harbor` | HarborClient desktop | Collection/request tools, `ask_user`, plugin tools |
| `hub` | Team Hub server | `search_docs`, configured MCP tools |
| `renderer` | HarborClient desktop | `tool.result` rows only (not used on `tool.call`) |

**Hub-native tools** (`search_docs`, MCP) run inside the Hub inner loop. The hub emits `tool.call` / `tool.result` with `owner: 'hub'` and feeds results back to the provider without returning passthrough calls.

**Harbor-owned tools** remain passthrough. The hub emits `tool.call` with `owner: 'harbor'` and returns those calls in `step.end.toolCalls` for the desktop to execute.

**Mixed completions:** When a single provider completion returns both Harbor passthrough calls and hub-native calls, **passthrough wins**. The hub emits Harbor `tool.call` events, returns passthrough `toolCalls` in `step.end`, and deliberately does not execute hub-native calls from that completion.

**`ask_user`:** Always `owner: 'harbor'`. Execution and `turn.awaiting_user` are renderer responsibilities; the hub never runs `ask_user`.

## Iteration limits

Two nested loops apply (constants in `@harborclient/core`):

| Constant | Value | Boundary |
| -------- | ----- | -------- |
| `AI_AGENT_MAX_RENDERER_STEP_ITERATIONS` | 8 | Renderer outer loop per user message |
| `AI_AGENT_MAX_HUB_INNER_ITERATIONS` | 8 | Hub provider + tool iterations per `completeChatStep` invoke |

Worst case provider steps per user message is **8 × 8**, not a single combined cap. When a boundary is hit, `step.end` or `turn.end` includes `iteration: { hitIterationLimit: true, boundary: 'hub_inner' | 'renderer_outer' }`.

## JSON step endpoint

`POST /llm/chat/step` returns the same final payload as `step.end` in one JSON response. It remains **fully supported** for stateless integrations and tests. HarborClient desktop prefers `POST /llm/chat/stream` for live deltas; there is no planned removal of the JSON endpoint.

## Reverse proxies

`POST /llm/chat/stream` sets `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, and **`X-Accel-Buffering: no`** so Nginx and compatible proxies flush frames immediately.

Self-hosted reverse proxies must disable response buffering on this path and use extended read/send timeouts (hub steps can run for minutes when MCP tools are involved). See [Configuration — AI chat stream proxies](./configuration.md#ai-chat-stream-proxies) and [Docker Compose — LLM chat stream](./deploy/docker.md#llm-chat-stream-post-llmchatstream-behind-a-reverse-proxy).

Heartbeats: the hub writes an SSE comment `: heartbeat` every **30 seconds** while the stream is open, plus an initial `: connected` comment after headers.

## Related docs

- [API Endpoints — POST /llm/chat/stream](./endpoints.md#post-llmchatstream)
- [LLM Proxy](./llm.md)
- [`@harborclient/team-hub-api` streaming usage](https://harborclient.com/team-hub-api/usage#llm-chat-streaming)
