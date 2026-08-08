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
| [Docker Compose — External Postgres and Redis](/deploy/docker#external-postgres-and-redis) | You want app-only Compose against managed or separate Postgres/Redis (`compose.external.yaml`) |
| [npm CLI](/deploy/npm) | You want the optional `team-hub deploy` wrapper around Docker Compose (bundled image only) |
| [VPS](/deploy/vps) | You are installing on a Linux VPS (install, persistence, sizing, and upgrade path to multi-instance) |
| [Google Cloud Run](/deploy/gcp) | You want a managed Cloud Run service with Cloud SQL and Memorystore |
| [Kubernetes](/deploy/k8s) | You want ≥2 replicas with external Postgres/Redis (Kustomize manifests) |

## What is in the container

| Process  | Default bind     | Purpose                       |
| -------- | ---------------- | ----------------------------- |
| Nginx    | `$PORT` (`8080`) | Reverse proxy to Team Hub     |
| Team Hub | `127.0.0.1:8787` | Fastify API                   |
| Postgres | `127.0.0.1:5432` | Database (bundled by default) |
| Redis    | `127.0.0.1:6379` | Auth throttling store         |

On startup the entrypoint:

1. Initializes bundled Postgres on first boot (creates the `harbor` user and database).
2. Copies `/etc/team-hub/server.yaml` from the image template on first boot (skips if the file already exists). Placeholders such as `${TEAM_HUB_DB_PASSWORD}` are resolved from the process environment at load/reload — not baked into the file.
3. Runs `team-hub migrate` (unless `TEAM_HUB_SKIP_MIGRATE=true`), then `team-hub start`.
4. Starts Nginx on `$PORT`.

For single-container Compose/VPS, leave `TEAM_HUB_SKIP_MIGRATE` unset (default `false`) so schema updates apply on each start. For multi-replica Cloud Run/Kubernetes, set `TEAM_HUB_SKIP_MIGRATE=true` on serving instances and run migrate once as a Job or one-off container before traffic — see [Docker Compose](/deploy/docker), [Google Cloud Run](/deploy/gcp), and [Kubernetes](/deploy/k8s).

Health probes (proxied through Nginx):

| Route | Use for |
| ----- | ------- |
| `GET /healthz` | Liveness — process is up; never fails on DB/Redis outages |
| `GET /readyz` | Readiness — DB + Redis reachable (and notice pub/sub when enabled) |
| `GET /health` | Legacy shallow check (same as `/healthz`); keep for existing clients |

See [API Endpoints — Health](/endpoints#health) for response shapes.

### Graceful shutdown

Containers stop with `SIGTERM`. Team Hub drains notice SSE streams, fails readiness immediately, then disconnects DB/Redis/MCP within `TEAM_HUB_SHUTDOWN_TIMEOUT_MS` (default 25s). Keep the platform stop grace period above that value (typically 30–60s). See [Docker Compose — Graceful shutdown](/deploy/docker#graceful-shutdown).

### Bundled vs managed services

The default image starts Postgres and Redis inside the container. That is convenient for demos, smoke tests, and self-hosted Docker with a persistent volume.

For production, either:

- Mount a volume for bundled Postgres (typical on a [VPS](/deploy/vps)), or
- Disable bundled services and point Team Hub at external Postgres and Redis (required on [Google Cloud Run](/deploy/gcp) and [Kubernetes](/deploy/k8s), where container storage is ephemeral).
- At higher replica counts, place a connection pooler (PgBouncer, RDS Proxy) in front of the **primary** writer. Team Hub uses a single `db.host` with no app-level read/write split — see [Configuration — Read replicas and connection pooling](/configuration#read-replicas-and-connection-pooling).

Reusable Compose and Kubernetes references for the external path live under `packages/team-hub/deploy/`:

- [`compose.external.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.yaml) — app-only against bring-your-own Postgres/Redis
- [`compose.external.reference.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.reference.yaml) — local smoke stack with separate Postgres + Redis containers
- [`k8s/`](https://github.com/harborclient/harborclient/tree/main/packages/team-hub/deploy/k8s) — Kustomize Deployment, Service, Ingress, and migrate Job

See [Docker Compose — External Postgres and Redis](/deploy/docker#external-postgres-and-redis) and [Kubernetes](/deploy/k8s). The npm `team-hub deploy` CLI still installs the bundled [`compose.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.yaml); external operators run `docker compose -f compose.external.yaml` or `kubectl apply -k` directly.

### Scaling journey

Typical progression when a single box is no longer enough:

1. Start on a [VPS](/deploy/vps) with bundled Postgres/Redis and a persistent volume.
2. Externalize Postgres and Redis ([Compose external](/deploy/docker#external-postgres-and-redis)), then enable notice pub/sub and scale app replicas — see [VPS — Graduating beyond a single VPS](/deploy/vps#graduating-beyond-a-single-vps).
3. Move to [Kubernetes](/deploy/k8s) or [Google Cloud Run](/deploy/gcp) when you want managed orchestration, probes, and migrate Jobs.

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
