# Contributing

Guidance for humans and agents working on HarborClient. See also
[AGENTS.md](./AGENTS.md) and [TESTING.md](./TESTING.md).

## Development

```bash
pnpm install
pnpm dev
```

Use `pnpm` only (lockfile: `pnpm-lock.yaml`). Do not use npm or yarn.

## Project layout

HarborClient is an Electron app built with [electron-vite](https://electron-vite.org/).
Source lives under `src/`:

| Path            | Role                                                              |
| --------------- | ----------------------------------------------------------------- |
| `src/main/`     | Main process — HTTP, SQLite, IPC handlers, menus, settings        |
| `src/preload/`  | Preload script — exposes a typed `window.api` via `contextBridge` |
| `src/renderer/` | React UI (Redux Toolkit, Tailwind CSS v4)                         |
| `src/shared/`   | Types and pure utilities shared across processes                  |

Build output goes to `out/`. User docs are in `docs/` (VitePress).

## IPC contract

The renderer never imports Node or Electron APIs directly. All main-process
access goes through `window.api`, defined in three places that must stay in sync:

1. **`src/shared/types.ts`** — `Api` interface and shared request/response types
2. **`src/preload/index.ts`** — thin `ipcRenderer.invoke` wrappers, exposed via
   `contextBridge.exposeInMainWorld('api', api)`
3. **`src/main/ipc.ts`** — `ipcMain.handle` handlers that delegate to main-process modules

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

| Alias     | Resolves to | Used in                               |
| --------- | ----------- | ------------------------------------- |
| `#/*`     | `./src/*`   | TypeScript, preload, renderer imports |
| `@images` | `./images`  | Renderer (Vite alias)                 |

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

User-facing docs live in `docs/` and publish to [harborclient.com](https://harborclient.com/).

- Do not hand-edit generated nav output — run `pnpm docs:build:nav` (or
  `pnpm docs:serve` for local preview).
- `docs/.vitepress/cache/` is a VitePress build cache; never commit it.

## Commits and changelog

Commit subjects become changelog entries via the `post-commit` hook. See
[AGENTS.md](./AGENTS.md#changelog) for details.

Write imperative, single-line subjects that describe the user-visible change
(e.g. `Fix cookie jar not persisting Set-Cookie headers`, not
`fixed cookies` or `WIP`).

## Releases

Do not bump versions locally. Maintainers trigger releases via the GitHub
Actions workflow (`pnpm release`, `pnpm release:minor`, etc.).
