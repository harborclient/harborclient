# Development

From the monorepo root:

```bash
pnpm --filter @harborclient/core lint
pnpm --filter @harborclient/core typecheck
pnpm --filter @harborclient/core test
pnpm --filter @harborclient/core build
```

Docs (this site):

```bash
pnpm --filter @harborclient/core docs:serve   # VitePress + nav watcher
pnpm --filter @harborclient/core docs:build   # production build
```

Always run tests via `pnpm test` at the monorepo root (or the filter scripts above) — do not invoke `vitest` directly, so native module ABIs stay aligned with Electron.
