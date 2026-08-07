# Deploy

Team Hub ships as an all-in-one Docker image published to GitHub Container Registry:

```text
ghcr.io/harborclient/team-hub:<version>
```

The image includes **Nginx** (public entrypoint on `$PORT`, default `8080`), the **Team Hub API**, **Postgres** (default database), and **Redis** (authentication throttling). Production servers pull a prebuilt image — they do not need a Git checkout or a TypeScript build.

Notice SSE (`GET /notices/stream`) is proxied through Nginx with buffering disabled. HarborClient desktop clients use the stream when available and fall back to REST polling on older servers or transient disconnects.

For local development without the full image, run Postgres and Redis via [`docker compose up -d`](../../docker-compose.yml) and start Team Hub on the host — see [Setup](/setup).

## Choose a guide

| Guide | Use when |
| ----- | -------- |
| [Docker Compose](/deploy/docker) | You want the standard DevOps deployment with `compose.yaml` and GHCR |
| [npm CLI](/deploy/npm) | You want the optional `team-hub deploy` wrapper around Docker Compose |
| [VPS](/deploy/vps) | You are installing on a Linux VPS (firewall, persistence, day-two ops) |
| [Google Cloud Run](/deploy/gcp) | You want a managed Cloud Run service with Cloud SQL and Memorystore |

## What is in the container

| Process  | Default bind     | Purpose                       |
| -------- | ---------------- | ----------------------------- |
| Nginx    | `$PORT` (`8080`) | Reverse proxy to Team Hub     |
| Team Hub | `127.0.0.1:8787` | Fastify API                   |
| Postgres | `127.0.0.1:5432` | Database (bundled by default) |
| Redis    | `127.0.0.1:6379` | Auth throttling store         |

On startup the entrypoint:

1. Initializes bundled Postgres on first boot (creates the `harbor` user and database).
2. Renders `/etc/team-hub/server.yaml` from environment variables on first boot (skips if the file already exists).
3. Runs `team-hub migrate`, then `team-hub start`.
4. Starts Nginx on `$PORT`.

Health checks should use `GET /health` (proxied through Nginx).

### Bundled vs managed services

The default image starts Postgres and Redis inside the container. That is convenient for demos, smoke tests, and self-hosted Docker with a persistent volume.

For production, either:

- Mount a volume for bundled Postgres (typical on a [VPS](/deploy/vps)), or
- Disable bundled services and point Team Hub at external Postgres and Redis (required on [Google Cloud Run](/deploy/gcp), where container storage is ephemeral).

## Image tags

Team Hub publishes images when a `team-hub-v*` release completes. For release `team-hub-v0.8.0`:

- `ghcr.io/harborclient/team-hub:0.8.0`
- `ghcr.io/harborclient/team-hub:0.8`
- `ghcr.io/harborclient/team-hub:0`
- `ghcr.io/harborclient/team-hub:latest`

`latest` is published for release builds only — not for arbitrary branches or pull requests.

After the first publish, you may need to set the GHCR package visibility to **Public** under GitHub → Packages → `team-hub` → Package settings.

## Related docs

- [Configuration](/configuration) — `server.yaml` reference and Docker env mapping
- [CLI](/cli) — users, tokens, collections
- [Authentication](/auth) — bearer tokens and Redis throttling
- [Setup](/setup) — install and run on the host
