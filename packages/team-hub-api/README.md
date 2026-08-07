# @harborclient/team-hub-api

**Full documentation:** [https://harborclient.com/team-hub-api/](https://harborclient.com/team-hub-api/)

**TypeScript client for the HarborClient Team Hub API**

`@harborclient/team-hub-api` is a library for typed HTTP access to HarborClient Team Hub collections, environments, folders, saved requests, and discussions:

- **Typed HTTP client:** Zod-validated request and response shapes for Team Hub endpoints.
- **Full API coverage:** Collections, environments, folders, saved requests, discussions, admin, and session APIs.
- **Capability-aware usage:** Session capabilities guide when to call management, discussions, and user-scoped methods.

## Documentation

| Topic           | Link                                                               |
| --------------- | ------------------------------------------------------------------ |
| Getting started | [Introduction](https://harborclient.com/team-hub-api/)             |
| Installation    | [Install](https://harborclient.com/team-hub-api/install)           |
| Usage           | [Usage](https://harborclient.com/team-hub-api/usage)               |
| API reference   | [API coverage](https://harborclient.com/team-hub-api/api-coverage) |

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run `pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

From the monorepo root:

```bash
pnpm install
pnpm --filter @harborclient/team-hub-api lint
pnpm --filter @harborclient/team-hub-api typecheck
pnpm --filter @harborclient/team-hub-api test
pnpm --filter @harborclient/team-hub-api build
pnpm --filter @harborclient/team-hub-api docs:serve
```

## License

MIT
