# HarborClient Roadmap

This document outlines where HarborClient is headed. It is a living guide, not a
fixed schedule — priorities shift based on user feedback, bug reports, and
maintainer capacity.

**Shipped work** is tracked in [CHANGELOG.md](./CHANGELOG.md). **User-facing
docs** live at [harborclient.com](https://harborclient.com/).

## Principles

Every roadmap item is weighed against these goals:

- **You own your data** — local SQLite by default; optional MySQL, PostgreSQL,
  Firestore, Git-backed collections, or a self-hosted [Team Hub](https://github.com/harborclient/team-hub).
- **No lock-in** — no accounts, subscriptions, or required cloud sync.
- **Familiar workflow** — collections, environments, scripts, and imports from
  Postman and Bruno for a smooth switch.
- **Extensible** — plugins, themes, and scripting without routing secrets
  through HarborClient infrastructure.
- **Accessible by default** — keyboard, screen-reader, and contrast
  requirements are part of core UI work, not a separate polish pass.

HarborClient does **not** aim for full Postman feature parity. Some imported
settings and scripts may need adjustment after migration.

## Status key

| Status        | Meaning                                            |
| ------------- | -------------------------------------------------- |
| **Shipped**   | Available in a released build                      |
| **Active**    | Under active development on `main`                 |
| **Planned**   | Committed direction; design or implementation next |
| **Exploring** | Under consideration; may change or be deferred     |

## Shipped (recent highlights)

Core REST/HTTP workflow, pluggable storage, Git integration, encrypted sharing,
collection runner, global search, request tags, cookie jar management, pre/post
request scripts with snippets, JMESPath on JSON responses, plugin marketplace,
theme plugins with deep-link install, and an AI assistant that uses your own API
keys stored locally.

See [CHANGELOG.md](./CHANGELOG.md) for the full release history.

## Active

Work currently landing on `main` or in frequent release cycles:

- **Accessibility** — keyboard operability, focus management, ARIA patterns, and
  WCAG contrast across modals, sidebars, and custom controls (see
  [AGENTS.md](./AGENTS.md) for renderer UI requirements).
- **AI assistant** — richer tools for inspecting collections, editing requests
  and scripts, and working with responses.
- **Plugin ecosystem** — marketplace catalog growth, signed packages, and clearer
  developer APIs via [`@harborclient/sdk`](https://github.com/harborclient/harborclient-sdk).

## Planned

Features we intend to build in HarborClient itself (not only via plugins):

- **Popout windows** -- Sidebars, request tabs, and others can popup into their own window.
- **Nested collection folders** — today, Postman and Bruno imports flatten nested
  folders to a single level; native multi-level folders in the sidebar and
  export format.
- **Additional request body types** — binary and file uploads beyond
  JSON, text, multipart, and urlencoded.
- **Broader import coverage** — more auth modes, saved responses, path variables,
  and environment data from Postman and Bruno exports.
- **GraphQL requests** — first-class editor and send path (today, GraphQL bodies
  from imports are omitted).
- **WebSocket clients** — connect, send frames, and inspect messages in the
  workspace.
- **gRPC** — explore support for unary and streaming RPC workflows.
- **Git over SSH** — today, Git remotes require HTTPS with a token or OAuth; SSH
  key support is a planned addition.
- **Echo server LAN access** — optional opt-in to expose the built-in echo
  server beyond localhost.

## Exploring

Ideas under evaluation. Order and inclusion are not guaranteed:

- **Mock servers** — local or collection-scoped response stubs.
- **OpenAPI / Swagger codegen** — expand beyond the existing OpenAPI plugin
  toward tighter in-app import and sync.
- **HTTP/2 and HTTP/3** — lower-level protocol visibility and tuning where
  Electron and Node networking allow.
- **Additional storage backends** — community-driven adapters via the storage
  plugin surface.
- **Mobile or web client** — HarborClient remains a desktop-first product; other
  form factors are exploratory only.
- **Team Hub enhancements** — tighter sync, permissions, and audit workflows
  in the [team-hub](https://github.com/harborclient/team-hub) companion repo.

## Non-goals

We do not plan to:

- Require user accounts or paid tiers for core features.
- Host or mandate vendor-controlled collection sync.
- Store API keys or collection data on HarborClient-operated servers.
- Replicate every Postman Cloud, Monitor, or Flow feature.

## Related projects

| Project                                                                | Role                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [harborclient-site](https://github.com/harborclient/harborclient-site) | Documentation and plugin marketplace catalog                          |
| [team-hub](https://github.com/harborclient/team-hub)                   | Self-hosted collaboration server                                      |
| [harborclient-sdk](https://github.com/harborclient/harborclient-sdk)   | Plugin and UI component APIs                                          |
| Community plugins                                                      | Themes, OpenAPI import, history, Dotenv, and more via the marketplace |

## How to influence the roadmap

1. **Open a [feature request](https://github.com/harborclient/harborclient/issues/new/choose)**
   — describe the problem, your workflow, and alternatives you considered.
2. **Report import gaps** — include a minimal Postman or Bruno export (redact
   secrets) when something is dropped on import.
3. **Build a plugin** — many gaps (themes, OpenAPI, custom endpoints) are
   intentionally addressed through the plugin system first. See the
   [plugin development guide](https://harborclient.com/plugin_development).
4. **Contribute code** — see [CONTRIBUTING.md](./CONTRIBUTING.md) for layout,
   IPC contracts, and testing expectations.

Maintainers prioritize bug fixes, security issues, and regressions over new
features. Well-scoped pull requests with tests for `src/main/` and `src/shared/`
logic are especially welcome.

---

_Last updated: July 2026. This file is updated manually when direction changes;
day-to-day progress remains in [CHANGELOG.md](./CHANGELOG.md)._
