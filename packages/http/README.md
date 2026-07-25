# @harborclient/http

**Full documentation:** [https://harborclient.github.io/harborclient/http/](https://harborclient.github.io/harborclient/http/)

**Outbound HTTP utilities for HarborClient.**

@harborclient/http is a library for URL and header validation, request body encoding, fetch execution (with optional undici dispatcher for SSL and proxy settings), response size limits, and redirect following:

- **Request execution:** `Requester` with configurable timeouts, SSL verification, proxy support, and redirect following.
- **Validation and encoding:** URL/header validation and request body encoding via `QueryString` and related helpers.
- **Safety limits:** Built-in response size caps via `HARD_MAX_RESPONSE_SIZE_MB`.

## Documentation

| Topic           | Link                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| Getting started | [Introduction](https://harborclient.github.io/harborclient/http/)             |
| Installation    | [Installation](https://harborclient.github.io/harborclient/http/installation) |
| Usage           | [Usage](https://harborclient.github.io/harborclient/http/usage)               |

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run `pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

This package lives in the [HarborClient monorepo](https://github.com/harborclient/harborclient). Run from the repo root:

```bash
pnpm install
pnpm --filter @harborclient/http test
pnpm docs:http:serve    # VitePress dev server with nav watcher
pnpm docs:http:build    # production docs build
```

## License

MIT
