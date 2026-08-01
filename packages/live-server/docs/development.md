# Development

This package lives in the [HarborClient monorepo](https://github.com/harborclient/harborclient).
From the repo root:

```bash
pnpm install
pnpm --filter @harborclient/live-server lint
pnpm --filter @harborclient/live-server typecheck
pnpm --filter @harborclient/live-server test
pnpm --filter @harborclient/live-server build
```

## Docs

Canonical pages live under [`docs/`](https://github.com/harborclient/harborclient/tree/main/packages/live-server/docs).
Edit those files directly, then refresh the VitePress sidebar:

```bash
pnpm docs:live-server:serve    # VitePress dev server with nav watcher
pnpm docs:live-server:build    # production docs build
```

Published docs: [https://harborclient.com/live-server/](https://harborclient.com/live-server/).
