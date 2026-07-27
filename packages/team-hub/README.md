![Team Hub](images/logo.png)

**Full documentation:** [https://harborclient.com/team-hub/](https://harborclient.com/team-hub/)

**Linux CLI server for shared HarborClient storage and team workflows.**

`team-hub` is the central server companion to [HarborClient](https://github.com/harborclient/harborclient):

- **CLI-first:** Run and manage the server from the `team-hub` command.
- **Fastify HTTP API:** HTTP server scaffold ready for HarborClient desktop clients.
- **Configurable storage:** YAML-based server config with MySQL database support.

## Documentation

| Topic           | Link                                                             |
| --------------- | ---------------------------------------------------------------- |
| Getting started | [Introduction](https://harborclient.com/team-hub/)               |
| Prerequisites   | [Prerequisites](https://harborclient.com/team-hub/prerequisites) |
| Setup           | [Setup](https://harborclient.com/team-hub/setup)                 |
| Development     | [Development](https://harborclient.com/team-hub/development)     |

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run `pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

From the monorepo root:

```bash
pnpm install
pnpm --filter @harborclient/team-hub test
pnpm --filter @harborclient/team-hub docs:serve
pnpm --filter @harborclient/team-hub docs:build
```

## License

MIT
