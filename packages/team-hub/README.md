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

## Deployment

Team Hub production deployments use a **prebuilt Docker image** published to GitHub Container Registry (GHCR). The npm package includes an **optional** CLI that wraps Docker Compose — Docker remains the runtime.

| Topic            | Link                                                              |
| ---------------- | ----------------------------------------------------------------- |
| Deploy overview  | [Deploy](https://harborclient.com/team-hub/deploy/)               |
| Docker Compose   | [Docker Compose](https://harborclient.com/team-hub/deploy/docker) |
| npm CLI          | [npm CLI](https://harborclient.com/team-hub/deploy/npm)           |
| VPS              | [VPS](https://harborclient.com/team-hub/deploy/vps)               |
| Google Cloud Run | [Google Cloud Run](https://harborclient.com/team-hub/deploy/gcp)  |

### Standard Docker deployment

```bash
# Copy compose.yaml from the npm package or repository (packages/team-hub/deploy/compose.yaml)
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.yaml
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/.env.example
cp .env.example .env   # edit APP_VERSION and TEAM_HUB_DB_PASSWORD

docker compose pull
docker compose up -d --remove-orphans
```

Image: `ghcr.io/harborclient/team-hub:<version>` (for example `0.8.0` or `latest`).

### Optional CLI deployment

```bash
npm install --global @harborclient/team-hub
team-hub deploy install
team-hub deploy status
team-hub deploy logs --tail 200
team-hub deploy update
```

The CLI pulls the GHCR image and manages `~/.config/team-hub` by default. It does **not** build the application image locally. Advanced operators can use Docker Compose directly without installing the CLI.

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
