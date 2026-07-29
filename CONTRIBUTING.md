# Contributing

Guidance for humans and agents working on HarborClient. See also
[AGENTS.md](./AGENTS.md) and [TESTING.md](./TESTING.md).

## Development

```bash
pnpm install
pnpm dev
```

Use `pnpm` only (lockfile: `pnpm-lock.yaml`). Do not use npm or yarn.

`pnpm dev` builds the SDK once, then runs SDK and GUI watchers together. You can
also run them separately: `pnpm dev:sdk` (tsc + runtime assets) and
`pnpm dev:gui` (electron-vite). See [AGENTS.md](./AGENTS.md) for agent-safe
dev-server guidance.

## Project layout

HarborClient is a pnpm monorepo:

| Path                       | Role                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `apps/harborclient/`       | Product package — argv router, `--help`/`--version`, electron-builder, release version |
| `apps/gui/`                | Electron GUI (`@harborclient/gui`) — main, preload, renderer                           |
| `apps/cli/`                | CLI implementation (`@harborclient/cli`) — invoked via the product binary              |
| `packages/core/`           | `@harborclient/core` — types, request runner, SES scripts, shared utilities            |
| `packages/sdk/`            | `@harborclient/sdk` — plugin/theme SDK, React components, runtime, signing             |
| `packages/http/`           | `@harborclient/http` — outbound HTTP: request execution, encoding, validation, timing  |
| `packages/team-hub/`       | `@harborclient/team-hub` — self-hosted Team Hub CLI/server                             |
| `packages/team-hub-api/`   | `@harborclient/team-hub-api` — typed HTTP client for Team Hub                          |
| `packages/storage-sqlite/` | `@harborclient/storage-sqlite` — SQLite `IStorage` implementation                      |

### Product (`apps/harborclient`)

Owns the public `harborclient` binary entry. Classifies argv and either opens
the GUI, re-execs the CLI under `ELECTRON_RUN_AS_NODE`, or prints help/version.
See [`apps/harborclient/README.md`](apps/harborclient/README.md).

### GUI (`apps/gui`)

Built with [electron-vite](https://electron-vite.org/). Source lives under `apps/gui/src/`:

| Path            | Role                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `src/main/`     | Main process — Electron host, IPC handlers, menus, settings adapters |
| `src/preload/`  | Preload script — exposes a typed `window.api` via `contextBridge`    |
| `src/renderer/` | React UI (Redux Toolkit, Tailwind CSS v4)                            |

Shared types and engine code live in `packages/core` (import as `@harborclient/core/...`).

Plugin subsystem architecture is documented in
[`apps/gui/src/renderer/src/plugins/README.md`](apps/gui/src/renderer/src/plugins/README.md).

Build output goes to `apps/gui/out/` (main entry is the product router from
`apps/harborclient/src/index.ts`). User docs live in the
[harborclient-site](https://github.com/harborclient/harborclient-site) repository.

## IPC contract

The renderer never imports Node or Electron APIs directly. All main-process
access goes through `window.api`, defined in three places that must stay in sync:

1. **`packages/core/src/types/`** (and related modules) — domain type modules and `api/` IPC contract (`Api` interface)
   Re-exported from **`packages/core/src/types.ts`** for deep imports via `@harborclient/core/types`
2. **`apps/gui/src/preload/index.ts`** — thin `ipcRenderer.invoke` wrappers, exposed via
   `contextBridge.exposeInMainWorld('api', api)`
3. **`apps/gui/src/main/ipc/index.ts`** — `ipcMain.handle` handlers that delegate to main-process modules

When adding or changing an IPC method, update all three files. Do not bypass
the preload bridge or expose additional Node/Electron APIs to the renderer.

Channel names follow the pattern `resource:action` (e.g. `collections:list`,
`http:send`).

## State management

The renderer uses Redux Toolkit (`src/renderer/src/store/`). Slices live in
`store/slices/`. Async work that touches `window.api` uses `createAsyncThunk`.
`busyMiddleware` tracks in-flight thunks for UI loading states.

## Code style

- TypeScript with `strict` enabled; ESM modules throughout.
- Prettier: single quotes, semicolons, `printWidth: 100`, no trailing commas.
  Run `pnpm format` to apply, or rely on ESLint's `prettier/prettier` rule.
- Public functions and all preload IPC wrappers use JSDoc.
- Match existing naming, import style, and abstractions in the file you edit.
  Reuse and extend what's there rather than introducing parallel patterns.

### Path aliases

| Alias                                         | Resolves to                              | Used in                                   |
| --------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| `#/*`                                         | `./src/*` within `apps/gui`              | GUI TypeScript, preload, renderer imports |
| `@harborclient/core` / `@harborclient/core/*` | `packages/core/src`                      | GUI, CLI, storage-sqlite                  |
| `@harborclient/sdk` / `@harborclient/sdk/*`   | `packages/sdk` (via workspace + `dist/`) | GUI, core, plugins                        |
| `@harborclient/http` / `@harborclient/http/*` | `packages/http/src`                      | GUI, core                                 |
| `@harborclient/team-hub-api`                  | `packages/team-hub-api/src`              | GUI, core                                 |
| `@harborclient/storage-sqlite`                | `packages/storage-sqlite/src`            | GUI, CLI                                  |
| `@images`                                     | repo-root `images/`                      | Renderer (Vite alias)                     |

Vitest resolves bare `#` to `./src` (see `vitest.config.ts`).

## Testing

See [TESTING.md](./TESTING.md) for philosophy, coverage expectations, shared
helpers, and when to add tests. Run the suite with `pnpm test` before merging.

## Dependencies

Do not add new dependencies without maintainer approval.

Native modules must be listed in `package.json` → `pnpm.onlyBuiltDependencies`
(currently `better-sqlite3`, `electron`, `esbuild`). Adding a new native dep
requires updating that list and verifying `postinstall` / test rebuild scripts.

Avoid large refactors unless explicitly requested.

## Documentation

User-facing docs and the plugin marketplace catalog live in
[harborclient-site](https://github.com/harborclient/harborclient-site) and
publish to [harborclient.com](https://harborclient.com/) via Docker/Nginx.

## Commits and changelog

Commit subjects become changelog entries via the `post-commit` hook. See
[AGENTS.md](./AGENTS.md#changelog) for details.

Write imperative, single-line subjects that describe the user-visible change
(e.g. `Fix cookie jar not persisting Set-Cookie headers`, not
`fixed cookies` or `WIP`).

## Releases

Do not bump versions locally. Maintainers trigger releases via the GitHub
Actions workflow (`pnpm release`, `pnpm release:minor`, etc.).
