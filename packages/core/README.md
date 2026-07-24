![@harborclient/core](https://raw.githubusercontent.com/harborclient/harborclient/main/images/logo.png)

**Full documentation:** [https://harborclient.github.io/harborclient/core/](https://harborclient.github.io/harborclient/core/)

**Platform-neutral HarborClient engine**

`@harborclient/core` is the shared library for HarborClient hosts (GUI, CLI, and storage adapters):

- **Request runner:** Host-agnostic HTTP pipeline with scripts, cookies, and variable substitution
- **Scripting:** SES-sandboxed pre/post scripts and assertion helpers
- **Shared types:** Domain models and the IPC `Api` contract used across the monorepo

## Documentation

| Topic           | Link                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| Getting started | [Introduction](https://harborclient.github.io/harborclient/core/)                 |
| Installation    | [Installation](https://harborclient.github.io/harborclient/core/installation)     |
| Package layout  | [Package layout](https://harborclient.github.io/harborclient/core/package-layout) |
| Request runner  | [Request runner](https://harborclient.github.io/harborclient/core/request-runner) |
| Scripting       | [Scripting](https://harborclient.github.io/harborclient/core/scripting)           |

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run `pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

```bash
pnpm install
pnpm --filter @harborclient/core test
pnpm --filter @harborclient/core docs:serve    # VitePress dev server with nav watcher
pnpm --filter @harborclient/core docs:build    # production docs build
```

## License

MIT
