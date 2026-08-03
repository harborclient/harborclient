# AI instructions and turn hooks

Use `hc.ai.instructions.add` for always-on agent policy, and `hc.ai.onBeforeTurn` / `hc.ai.onAfterTurn` for per-send lifecycle. These APIs require the `ai` permission and are activation-scoped.

See [hc.ai](/api/ai) for the full reference and [Chat pointers](/examples/chat-pointers) for `@` badge registration.

## Manifest

```json
{
  "id": "com.example.ai-policy",
  "name": "Example AI Policy",
  "version": "1.0.0",
  "permissions": ["ai"]
}
```

## Static instructions

Append fragments to the agent system prompt while the plugin is enabled. Plugins cannot rewrite Harbor's base prompt — only append.

```js
export function activate(hc) {
  hc.ai.instructions.add(
    'When the user asks about invoices, prefer the Invoice MCP tools over guessing field names.'
  );
}
```

## Before / after turn

Hooks fire **once per user chat turn** (not once per LLM tool-loop step):

```js
export function activate(hc) {
  hc.ai.onBeforeTurn((ctx) => {
    // Turn-only guidance (ephemeral system message for this send)
    ctx.instructions.push(`Active draft id: ${getActiveDraftId()}`);

    // Optionally rewrite model-facing user text (persisted DB row is unchanged)
    if (ctx.userMessage.content.startsWith('/brief ')) {
      ctx.userMessage.content = ctx.userMessage.content.slice('/brief '.length);
    }
  });

  hc.ai.onAfterTurn((ctx) => {
    if (ctx.status === 'error') {
      console.error('AI turn failed:', ctx.error?.message);
      return;
    }
    console.log('AI turn finished', ctx.stats);
  });
}
```

## Notes

- **Append-only** — use `instructions.add` for static policy and `ctx.instructions.push` for turn-scoped context.
- **Cancel** — call `ctx.cancel(reason)` in `onBeforeTurn` to abort before any LLM call.
- **Not HTTP hooks** — unrelated to `hc.http.onBeforeSend` / `onAfterSend`.
