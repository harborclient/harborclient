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
| **Planned**   | Committed direction; design or implementation next |
| **Exploring** | Under consideration; may change or be deferred     |

## Planned

Features we intend to build in HarborClient itself (not only via plugins):

- **Nested folders** -- Native multi-level folders in the sidebar and
  export format.
- **Git over SSH** -- today, Git remotes require HTTPS with a token or OAuth; SSH
  key support is a planned addition.
- **Echo server LAN access** -- optional opt-in to expose the built-in echo
  server beyond localhost.

## Exploring

- **Popout windows** -- Sidebars, request tabs, and others can popup into their own window.
- **GraphQL requests** -- first-class editor and send path (today, GraphQL bodies
  from imports are omitted).
- **WebSocket clients** -- connect, send frames, and inspect messages in the
  workspace.
- **gRPC** -- explore support for unary and streaming RPC workflows.
