# Package layout

Source lives under `src/`. Major areas:

| Path | Role |
| --- | --- |
| `requestRunner/` | Host-agnostic HTTP request pipeline (`RequestRunner`) |
| `scripting/` | SES-sandboxed pre/post scripts, assertions, and the script API |
| `cookies/` | Cookie jar implementation used by request runs |
| `network/` | HTTP send helpers shared by hosts |
| `types/` | Domain types and the `api/` IPC contract surface |
| `interfaces/` | Host-facing interfaces (`ICookieJar`, `IScriptRunner`, settings) |
| `search/` | Unified search indexes and slash-command helpers |
| `ai/` | Chat/tool helpers used by AI features |
| `plugin/` | Plugin catalog, theme, and surface helpers |
| `snippet/` | Snippet catalog and bundle types |
