# HarborClient product package

Public product entry for the `harborclient` binary. Owns argv routing,
`--help` / `--version`, electron-builder packaging, and release versioning.

## Routing

The Electron main entry is [`src/index.ts`](src/index.ts). Before the GUI
loads, it classifies user argv:

| Argv                           | Route                          |
| ------------------------------ | ------------------------------ |
| _(empty)_                      | Open GUI                       |
| `-h` / `--help`                | Product help                   |
| `-V` / `--version`             | Product version                |
| `GET`…`OPTIONS` / `run …`      | CLI via `ELECTRON_RUN_AS_NODE` |
| `harborclient://…` / GUI flags | Open GUI                       |

CLI invocations re-exec the same binary as Node against the packaged
`resources/cli/index.js` (or `apps/cli/dist/index.js` in development). The GUI
main module is loaded only through a dynamic import on the GUI path, so CLI
calls never take the single-instance lock.

## Packages

| Package                                     | Role                               |
| ------------------------------------------- | ---------------------------------- |
| `@harborclient/harborclient` (this package) | Product router + release           |
| `@harborclient/gui`                         | Electron main / preload / renderer |
| `@harborclient/cli`                         | CLI implementation (internal)      |

## Scripts

```bash
pnpm --filter @harborclient/harborclient build   # core, sqlite, cli, gui
pnpm --filter @harborclient/harborclient dist    # build + electron-builder
pnpm --filter @harborclient/harborclient test    # router unit tests
```

From the monorepo root: `pnpm dist`, `pnpm dev` (GUI via router entry), `pnpm cli`.
