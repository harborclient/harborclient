# Docker Compose

Standard production deployment: pull the prebuilt GHCR image and run it with Docker Compose. No Node.js or Git checkout is required on the server.

For a friendlier wrapper around the same Compose flow, see [npm CLI](/deploy/npm). For host firewall, backups, and day-two VPS operations, see [VPS](/deploy/vps).

## Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/)
- [Docker Compose plugin](https://docs.docker.com/compose/install/)

## Deploy

1. Copy the production Compose template and environment example from this repository (`packages/team-hub/deploy/`) or from an installed npm package (`deploy/` directory inside `@harborclient/team-hub`):

```bash
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.yaml
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/.env.example
cp .env.example .env
```

This `compose.yaml` runs the all-in-one image with **bundled** Postgres and Redis. For app-only deploys against external Postgres and Redis, see [External Postgres and Redis](#external-postgres-and-redis) (`compose.external.yaml` and `compose.external.reference.yaml`).

2. Edit `.env` and set at least:

| Variable               | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `APP_VERSION`          | Image tag (`0.8.0`, `latest`, …)                     |
| `HOST_PORT`            | Host port mapped to container `8080` (default 8080)  |
| `TEAM_HUB_DB_PASSWORD` | Strong password for bundled Postgres                 |

3. Pull and start:

```bash
docker compose pull
docker compose up -d --remove-orphans
```

4. Verify health:

```bash
# Liveness (process up; no DB/Redis checks)
curl -s http://127.0.0.1:8080/healthz

# Readiness (DB + Redis reachable)
curl -s http://127.0.0.1:8080/readyz

# Legacy shallow check (same payload as /healthz)
curl -s http://127.0.0.1:8080/health
```

Expect liveness JSON like `{"status":"ok","version":"0.8.0"}`. Readiness returns the same status with a `checks` object for `db`, `redis`, and `noticeEvents`. First boot can take 30–60 seconds while Postgres initializes and migrations run.

## Image authentication

If the GHCR package is private, authenticate before pulling:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
```

Public packages do not need login.

## Updates and rollbacks

```bash
# Update to a newer tag (edit APP_VERSION in .env if needed)
docker compose pull
docker compose up -d --remove-orphans

# Roll back: set APP_VERSION to an older release, then pull/up again
```

By default the entrypoint runs migrations on each start, so schema updates apply automatically for single-container deploys. When running **multiple replicas** against one database, set `TEAM_HUB_SKIP_MIGRATE=true` on the serving containers and run migrate once before scaling (see [Multi-instance migrations and notice fan-out](#multi-instance-migrations-and-notice-fan-out)).

## Logs and lifecycle

```bash
docker compose logs --follow
docker compose logs --tail 200
docker compose stop          # keep containers and volumes
docker compose down          # remove containers; keep named volumes
docker compose down --volumes  # also delete Postgres data — destructive
```

## Direct docker run

Compose is recommended. Equivalent one-off run:

```bash
docker pull ghcr.io/harborclient/team-hub:0.8.0

docker run -d \
  --name team-hub \
  --restart unless-stopped \
  --env-file .env \
  -p 8080:8080 \
  -v team-hub-pgdata:/var/lib/postgresql/data \
  ghcr.io/harborclient/team-hub:0.8.0
```

## Local smoke test

Build from the monorepo root when testing Dockerfile changes locally:

```bash
docker build -f packages/team-hub/Dockerfile -t team-hub:local .

docker run --rm -p 8080:8080 \
  -e TEAM_HUB_DB_PASSWORD=harbor \
  team-hub:local
```

Mount a volume if you need Postgres data to survive restarts:

```bash
docker run --rm -p 8080:8080 \
  -v team-hub-pgdata:/var/lib/postgresql/data \
  -e TEAM_HUB_DB_PASSWORD=harbor \
  team-hub:local
```

## External Postgres and Redis

Use an **app-only** Compose file when Postgres and Redis run outside the Team Hub container — for example managed Cloud SQL / RDS / Memorystore, a multi-replica rollout, or ephemeral hosts (Cloud Run, Kubernetes) where bundled database storage is not durable.

The image still contains bundled Postgres and Redis binaries, but `TEAM_HUB_START_POSTGRES=false` and `TEAM_HUB_START_REDIS=false` keep those processes off. The external Compose templates hardcode those flags so a mistaken `.env` cannot re-enable them.

| File | Purpose |
| ---- | ------- |
| [`compose.external.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.yaml) | App-only; point `.env` at your Postgres and Redis hosts |
| [`compose.external.reference.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.reference.yaml) | Local smoke stack: separate Postgres + Redis containers + app-only Team Hub |

The npm `team-hub deploy` wrapper still installs the bundled [`compose.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.yaml). For external mode, run `docker compose -f compose.external.yaml` (or the reference file) directly.

### Quick start (reference stack)

Local end-to-end test without managed cloud services:

```bash
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.reference.yaml
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.yaml
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/.env.example
cp .env.example .env
# Edit TEAM_HUB_DB_PASSWORD (used by the reference Postgres service)

docker compose -f compose.external.reference.yaml pull
docker compose -f compose.external.reference.yaml up -d

curl -s http://127.0.0.1:8080/healthz
curl -s http://127.0.0.1:8080/readyz
```

The reference file sets `TEAM_HUB_DB_HOST=postgres` and `TEAM_HUB_REDIS_HOST=redis` on the app service and waits for both dependencies to become healthy before starting Team Hub. Postgres and Redis are not published on the host — only Nginx on `HOST_PORT` (default 8080).

Compose healthchecks prefer `GET /readyz` and fall back to `GET /health` for older images that lack the readiness probe. Host-side checks should use `/healthz` and `/readyz` on current releases.

### Production (bring your own endpoints)

```bash
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.yaml
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/.env.example
cp .env.example .env
```

In `.env`, set at least:

| Variable | Purpose |
| -------- | ------- |
| `TEAM_HUB_DB_HOST` | Postgres hostname or IP (or `host.docker.internal` for host-published ports) |
| `TEAM_HUB_DB_PORT` | Postgres port (default `5432`) |
| `TEAM_HUB_DB_USER` / `TEAM_HUB_DB_PASSWORD` / `TEAM_HUB_DB_DATABASE` | Credentials |
| `TEAM_HUB_REDIS_HOST` / `TEAM_HUB_REDIS_PORT` | Redis endpoint |
| `TEAM_HUB_DB_SSL` | Optional `true` for managed Postgres that requires TLS |

```bash
docker compose -f compose.external.yaml pull
docker compose -f compose.external.yaml up -d
```

`compose.external.yaml` adds `host.docker.internal:host-gateway` so Linux hosts can reach Postgres/Redis published on the Docker host. `stop_grace_period` is already `30s` in the template (see [Graceful shutdown](#graceful-shutdown)).

### Migrate once against external Postgres

With bundled migrate skipped or when preparing multiple replicas, run migrate as a one-off using the same image and `.env`:

```bash
docker run --rm --env-file .env \
  -e TEAM_HUB_START_POSTGRES=false \
  -e TEAM_HUB_START_REDIS=false \
  --add-host=host.docker.internal:host-gateway \
  ghcr.io/harborclient/team-hub:0.8.0 \
  node /app/dist/cli.js -c /etc/team-hub/server.yaml migrate
```

For the reference stack, attach the one-off container to the Compose network and use the service hostnames `postgres` / `redis`, or `docker compose -f compose.external.reference.yaml run --rm team-hub node /app/dist/cli.js -c /etc/team-hub/server.yaml migrate` after the stack is up.

See [Multi-instance migrations and notice fan-out](#multi-instance-migrations-and-notice-fan-out) for the serving-side `TEAM_HUB_SKIP_MIGRATE` pattern.

### Scale to two or more replicas

When scaling the app service, migrate once first, then set:

```bash
TEAM_HUB_SKIP_MIGRATE=true
TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true
TEAM_HUB_DB_MAX=10   # example; see sizing below
```

```bash
docker compose -f compose.external.yaml up -d --scale team-hub=2
```

(`compose.external.yaml` omits a fixed `container_name` so Compose can scale.) Without `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true`, each replica only fans out notices in-memory and clients on other replicas miss events.

Size the pool so total connections stay under the database limit:

```text
replicas × TEAM_HUB_DB_MAX ≤ max_connections × 0.75
```

| Replicas | Example `TEAM_HUB_DB_MAX` | Approx. peak app connections |
| -------- | ------------------------- | ---------------------------- |
| 2 | 20 | 40 |
| 3 | 15 | 45 |
| 5 | 10 | 50 |

Leave ~25% of `max_connections` for admin sessions, migrations, and monitoring. See [Configuration — Pool sizing](/configuration#pool-sizing).

For high replica counts, place **PgBouncer**, **RDS Proxy**, or a similar pooler in front of Postgres and set a single `TEAM_HUB_DB_HOST` to that endpoint (or the managed writer hostname). Team Hub does not route reads to replicas; avoid proxy read-split unless you accept consistency risk. See [Configuration — Read replicas and connection pooling](/configuration#read-replicas-and-connection-pooling).

### Pairing with the package dev Compose

For host-side development, [`docker-compose.yml`](../../docker-compose.yml) publishes Postgres on `5435` and Redis on `6380`. To run the **production image** app-only against those services:

1. From `packages/team-hub`: `docker compose -f docker-compose.yml up -d`
2. Copy `deploy/.env.example` to `deploy/.env` and set:

```bash
TEAM_HUB_DB_HOST=host.docker.internal
TEAM_HUB_DB_PORT=5435
TEAM_HUB_DB_USER=harbor
TEAM_HUB_DB_PASSWORD=harbor
TEAM_HUB_DB_DATABASE=harbor
TEAM_HUB_REDIS_HOST=host.docker.internal
TEAM_HUB_REDIS_PORT=6380
```

3. `docker compose -f compose.external.yaml up -d` from `deploy/`

## Multi-instance migrations and notice fan-out

When several Team Hub containers share one database, parallel `migrate` on every start can race on DDL. Prefer a **migrate once, then serve** pattern:

1. Run migrate as a one-off container (same image, env, and secrets as the app):

```bash
docker run --rm --env-file .env \
  ghcr.io/harborclient/team-hub:0.8.0 \
  node /app/dist/cli.js -c /etc/team-hub/server.yaml migrate
```

For the full image entrypoint (bundled services, config generation), override the command carefully or `docker exec` into a running container. Against external Postgres/Redis, a one-off `node … migrate` with the same config is enough.

2. Start or scale the app with migrations skipped and Redis notice pub/sub enabled:

```bash
# In .env or compose environment:
TEAM_HUB_SKIP_MIGRATE=true
TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true
```

`TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true` sets `redis.noticeEventsPubSub: true` in the generated config so notice SSE (`GET /notices/stream`) fans out across replicas that share Redis. Without it, each process only broadcasts notices in-memory and clients on other replicas miss events. Enabling pub/sub uses a Redis publisher and subscriber per instance in addition to the auth throttle client.

Single-node Compose/VPS should leave `TEAM_HUB_SKIP_MIGRATE` and `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB` unset (defaults `false`) so upgrades keep applying schema automatically and in-process notice fan-out is used.

## Using the CLI in the container

Administration commands (`user`, `migrate`, `collection`, and so on) run through the same CLI as a host install. In the Docker image:

- The config file is at `/etc/team-hub/server.yaml` (template copied on first boot; `${TEAM_HUB_*}` placeholders resolved from env at runtime).
- The `team-hub` binary is not on `PATH`.
- The CLI does **not** read `TEAM_HUB_CONFIG` — pass `-c` explicitly, **before** the subcommand.

```bash
docker exec -it team-hub \
  node /app/dist/cli.js -c /etc/team-hub/server.yaml user list
```

### Create an admin user

```bash
docker exec -it team-hub \
  node /app/dist/cli.js -c /etc/team-hub/server.yaml user create --name ops --role admin
```

Copy the one-time `hbk_…` token immediately; it is not shown again.

### Create a desktop user

```bash
docker exec -it team-hub \
  node /app/dist/cli.js -c /etc/team-hub/server.yaml user create --name alice --role user \
  --collection-access '*' --environment-access '*'
```

### Reload or restart after config edits

| Section                       | Live reload? | Action |
| ----------------------------- | ------------ | ------ |
| `db`, `redis`, `llm`, `plugins` | Yes        | `SIGHUP` or `POST /admin/config/reload` |
| `logging`, `server.host` / `server.port` | No | Restart Team Hub process |

```bash
# Live reload (admin token required)
docker exec team-hub curl -s -X POST http://127.0.0.1:8787/admin/config/reload \
  -H "Authorization: Bearer hbk_your_admin_token_here"

# Restart Team Hub only (Nginx/Postgres/Redis stay up)
docker exec team-hub /docker/restart-team-hub.sh
```

To persist config across container recreation, bind-mount a host `server.yaml` to `/etc/team-hub/server.yaml`. Mounted files may use `${TEAM_HUB_DB_PASSWORD}` (and similar) so secrets stay in Compose/`env_file` rather than in the mounted YAML.

See [CLI](/cli) and [Configuration — Environment variable interpolation](/configuration#environment-variable-interpolation) for full reference.

## Documentation index

The Docker image bundles HarborClient documentation for hub-native `search_docs`. During `docker build`, the Dockerfile downloads `docsSearchIndex.json` (override with build arg `DOCS_INDEX_URL`) and copies it to `/app/data/docsSearchIndex.json`.

For self-hosted deployments without rebuilding the image, mount an updated index file and point `docs.searchIndexPath` in `server.yaml` at the mount path.

## Environment variable reference

| Variable                         | Default                          | Description                                                                |
| -------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `PORT`                           | `8080`                           | Nginx listen port (some platforms inject this at runtime)                  |
| `NGINX_SERVER_NAME`              | `_`                              | Nginx `server_name` (catch-all `_`; set to your hostname for named vhosts) |
| `TEAM_HUB_PORT`                  | `8787`                           | Internal Team Hub port                                                     |
| `TEAM_HUB_HOST`                  | `127.0.0.1`                      | Team Hub bind address                                                      |
| `TEAM_HUB_CONFIG`                | `/etc/team-hub/server.yaml`      | Config file path (template copied on first boot if missing)                |
| `TEAM_HUB_FORCE_CONFIG_GENERATE` | `false`                          | When `true`, overwrite an existing config from the image template          |
| `TEAM_HUB_START_POSTGRES`        | `true`                           | Start bundled Postgres                                                     |
| `TEAM_HUB_START_REDIS`           | `true`                           | Start bundled Redis                                                        |
| `TEAM_HUB_SKIP_MIGRATE`          | `false`                          | When `true`, skip `migrate` on start (run migrate as a Job for multi-replica) |
| `TEAM_HUB_DB_DRIVER`             | `postgres`                       | `postgres`, `mysql`, or `firestore`                                        |
| `TEAM_HUB_DB_HOST`               | `127.0.0.1`                      | Database host                                                              |
| `TEAM_HUB_DB_PORT`               | `5432`                           | Database port                                                              |
| `TEAM_HUB_DB_USER`               | `harbor`                         | Database user                                                              |
| `TEAM_HUB_DB_PASSWORD`           | `harbor`                         | Database password                                                          |
| `TEAM_HUB_DB_DATABASE`           | `harbor`                         | Database name                                                              |
| `TEAM_HUB_DB_MAX`                | _(empty)_                        | Optional pool size (`db.max`); leave empty for driver default              |
| `TEAM_HUB_DB_IDLE_TIMEOUT_MILLIS` | _(empty)_                       | Optional idle timeout in ms                                                |
| `TEAM_HUB_DB_CONNECTION_TIMEOUT_MILLIS` | _(empty)_                  | Optional connect timeout in ms                                             |
| `TEAM_HUB_DB_SSL`                | _(empty)_                        | Optional TLS toggle (`true` / `false`); object SSL needs a mounted YAML    |
| `TEAM_HUB_REDIS_HOST`            | `127.0.0.1`                      | Redis host                                                                 |
| `TEAM_HUB_REDIS_PORT`            | `6379`                           | Redis port                                                                 |
| `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB` | `false`                     | When `true`, enable Redis pub/sub for multi-instance notice SSE fan-out    |
| `TEAM_HUB_LOGGING_LEVEL`         | `info`                           | Log level (`debug`, `info`, `warn`, `error`)                               |
| `TEAM_HUB_LOGGING_FILE`          | `/var/log/team-hub/team-hub.log` | Log file path                                                              |
| `TEAM_HUB_LOGGING_CONSOLE`       | `true`                           | Write logs to the terminal                                                 |
| `TEAM_HUB_LOGGING_FORMAT`        | `json`                           | Log wire format (`json` or `simple`)                                       |
| `TEAM_HUB_METRICS_ENABLED`       | `true`                           | Expose Prometheus `/metrics` and HTTP instrumentation                      |
| `TEAM_HUB_METRICS_PATH`          | `/metrics`                       | Prometheus scrape path                                                     |
| `TEAM_HUB_METRICS_AUTH_TOKEN`    | _(empty)_                        | Optional Bearer token required to scrape metrics                           |
| `TEAM_HUB_SHUTDOWN_TIMEOUT_MS`   | `25000`                          | Force-exit deadline after SIGTERM/SIGINT (must be less than stop grace)    |

When running multiple app instances against one database, set `TEAM_HUB_DB_MAX` (or `db.max` in `server.yaml`) so `replicas × max` stays under the database `max_connections` with headroom. See [Configuration — Pool sizing](/configuration#pool-sizing).

Logging and metrics env vars are applied at process startup. Restart the container after changing them.

### Metrics smoke test

```bash
curl -s http://127.0.0.1:8080/metrics | head
```

You should see Prometheus text including `team_hub_http_requests_total` and process defaults. Keep `/metrics` off public reverse-proxy routes unless you set `TEAM_HUB_METRICS_AUTH_TOKEN`. See [Configuration — metrics](/configuration#metrics).

## Graceful shutdown

The image uses `STOPSIGNAL SIGTERM`. On stop, Team Hub:

1. Marks the process as shutting down so `GET /readyz` returns **503** immediately.
2. Closes open notice SSE streams (`GET /notices/stream`) so Fastify can finish `close()`.
3. Disposes hub MCP connections (with a short timeout) and disconnects DB/Redis.

Default force-exit is **25 seconds** (`TEAM_HUB_SHUTDOWN_TIMEOUT_MS`). Set the orchestrator or Docker stop grace period **higher** than that value:

| Platform | Recommended stop grace |
| -------- | ---------------------- |
| Docker Compose / `docker stop` | `--timeout 30` (or higher) |
| Kubernetes | `terminationGracePeriodSeconds: 30` (use **60** if LLM/MCP latency is high) |
| systemd | `TimeoutStopSec=30` (already in the [Setup](/setup) unit example) |

`TEAM_HUB_SHUTDOWN_TIMEOUT_MS` must stay **below** the platform grace period so the process can exit cleanly before SIGKILL. Long in-flight LLM chat steps may still be cut off if they exceed the grace period; HarborClient clients retry or fall back as needed.

## Troubleshooting

### Container exits during startup

Check `docker compose logs` or `docker logs team-hub`. Bundled Postgres + Redis + Node need at least **2 GiB** RAM. Ensure `PGDATA` (`/var/lib/postgresql/data`) is writable.

### `GET /healthz` or `GET /health` fails or connection refused

- Confirm the service listens on the mapped host port (default 8080).
- Wait for startup: migrations and Postgres init can take 30–60 seconds on cold start.

### `GET /readyz` returns 503

Readiness fails when the database or Redis is unreachable. Check `docker compose logs` and the `checks` object in the JSON body (`db`, `redis`, `noticeEvents`). See [Authentication](/auth).

When `redis.noticeEventsPubSub: true` is set for multi-instance notice SSE fan-out, readiness also requires healthy notice pub/sub; the notice stream route (`GET /notices/stream`) returns **503** if pub/sub is unavailable.

### Protected API routes return 503

Redis is required for auth throttling. Verify Redis is running (bundled) or reachable (external Redis). See [Authentication](/auth).

### Notice SSE (`GET /notices/stream`) disconnects behind a reverse proxy

Long-lived Server-Sent Events need proxy buffering disabled and extended read timeouts. The bundled Docker image configures Nginx for `/notices/stream` automatically (`proxy_buffering off`, `proxy_read_timeout 1h`, HTTP/1.1).

Self-hosted reverse proxies must apply equivalent settings on the SSE path only — normal REST routes can keep default buffering. HarborClient desktop clients fall back to REST polling when the stream is unavailable.

### Config file not found

The CLI defaults to `server.yaml` in the current directory. In the container pass `/etc/team-hub/server.yaml` with `-c` before the subcommand:

```bash
node /app/dist/cli.js -c /etc/team-hub/server.yaml user list
```

## Related guides

- [npm CLI](/deploy/npm) — optional Compose wrapper (bundled `compose.yaml` only)
- [VPS](/deploy/vps) — Linux host install and day-two ops
- [Google Cloud Run](/deploy/gcp) — managed serverless deploy with external Cloud SQL / Memorystore
- [Kubernetes](/deploy/k8s) — multi-replica Kustomize manifests (Deployment, migrate Job, SSE Ingress)
- [Deploy overview](/deploy/) — image tags and bundled vs managed services
