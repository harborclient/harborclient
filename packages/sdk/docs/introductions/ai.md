Chat pointers, append-only agent instructions, turn hooks, and copy-to-chat for the AI sidebar.

Requires the `ai` permission. Registrations are **activation-scoped**: Harbor merges `agentGuidance` and `hc.ai.instructions` into the agent system prompt while the plugin is enabled and removes them on dispose or unload. Historical message badges keep working from persisted snapshots.

Plugins **cannot** rewrite Harbor's base system prompt — they only append fragments (via chat-pointer `agentGuidance`, `instructions.add`, or turn-scoped `ctx.instructions.push`).

Turn hooks (`onBeforeTurn` / `onAfterTurn`) fire **once per user chat turn** (not per LLM tool-loop step), and are unrelated to `hc.http.onBeforeSend` / `onAfterSend`.
