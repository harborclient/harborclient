# @harborclient/live-server

**Full documentation:** [https://harborclient.com/live-server/](https://harborclient.com/live-server/)

**Headless HarborClient live-server host.**

Express static serving with path aliases, CORS, headers, proxies, routes,
custom error pages, pre/post request scripts, file watching, and an optional
supervised companion `runCommand`. Used by the Electron GUI main process and
the HarborClient CLI. Host-specific concerns (snippets, global variables,
script runner) are injected via `LiveServerHostProviders`.

## Documentation

| Topic           | Link                                                              |
| --------------- | ----------------------------------------------------------------- |
| Getting started | [Introduction](https://harborclient.com/live-server/)             |
| Installation    | [Installation](https://harborclient.com/live-server/installation) |
| Usage           | [Usage](https://harborclient.com/live-server/usage)               |
| Host API        | [Host API](https://harborclient.com/live-server/host-api)         |
| Development     | [Development](https://harborclient.com/live-server/development)   |

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run
`pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

This package lives in the [HarborClient monorepo](https://github.com/harborclient/harborclient).
Run from the repo root:

```bash
pnpm install
pnpm --filter @harborclient/live-server test
pnpm docs:live-server:serve    # VitePress dev server with nav watcher
pnpm docs:live-server:build    # production docs build
```

## License

MIT
