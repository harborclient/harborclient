Register remote MCP client servers so Harbor's chat agent can discover and call tools from external MCP endpoints over Streamable HTTP or legacy SSE.

Requires the `mcp` permission. Registrations are **activation-scoped**: Harbor connects while the plugin is enabled and removes them when you dispose the returned handle or the plugin unloads. Plugin-owned servers appear as **read-only** rows in **Settings → AI & MCP** with plugin attribution; they are not copied into user MCP settings.
