# Examples

Complete walkthroughs for common plugin patterns:

- [Request logger](/examples/request-logger) — main-only plugin that logs HTTP traffic to the terminal
- [Request audit tab](/examples/request-audit-tab) — read-only request editor tab
- [Solarized theme](/examples/solarized-theme) — theme plugin via `registerTheme` or JSON `import` (no JavaScript)
- [Import handler](/examples/import-handler) — **File → Import** handler with preview UI
- [MCP client server](/examples/mcp-client-server) — register a remote MCP endpoint for Harbor's chat agent

See [harborclient-plugin-skeleton](https://github.com/harborclient/plugin-skeleton) for a starter project with renderer and main entries.
