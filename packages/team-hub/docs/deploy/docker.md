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
curl -s http://127.0.0.1:8080/health
```

Expect JSON like `{"status":"ok","version":"0.8.0"}`. First boot can take 30–60 seconds while Postgres initializes and migrations run.

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

The entrypoint runs migrations on each start, so schema updates apply automatically.

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

## Using the CLI in the container

Administration commands (`user`, `migrate`, `collection`, and so on) run through the same CLI as a host install. In the Docker image:

- The config file is generated at `/etc/team-hub/server.yaml`.
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

To persist config across container recreation, bind-mount a host `server.yaml` to `/etc/team-hub/server.yaml`.

See [CLI](/cli) and [Configuration](/configuration) for full reference.

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
| `TEAM_HUB_CONFIG`                | `/etc/team-hub/server.yaml`      | Config file path (generated on first boot if missing)                      |
| `TEAM_HUB_FORCE_CONFIG_GENERATE` | `false`                          | When `true`, overwrite an existing config from env vars                    |
| `TEAM_HUB_START_POSTGRES`        | `true`                           | Start bundled Postgres                                                     |
| `TEAM_HUB_START_REDIS`           | `true`                           | Start bundled Redis                                                        |
| `TEAM_HUB_DB_DRIVER`             | `postgres`                       | `postgres`, `mysql`, or `firestore`                                        |
| `TEAM_HUB_DB_HOST`               | `127.0.0.1`                      | Database host                                                              |
| `TEAM_HUB_DB_PORT`               | `5432`                           | Database port                                                              |
| `TEAM_HUB_DB_USER`               | `harbor`                         | Database user                                                              |
| `TEAM_HUB_DB_PASSWORD`           | `harbor`                         | Database password                                                          |
| `TEAM_HUB_DB_DATABASE`           | `harbor`                         | Database name                                                              |
| `TEAM_HUB_REDIS_HOST`            | `127.0.0.1`                      | Redis host                                                                 |
| `TEAM_HUB_REDIS_PORT`            | `6379`                           | Redis port                                                                 |
| `TEAM_HUB_LOGGING_LEVEL`         | `info`                           | Log level (`debug`, `info`, `warn`, `error`)                               |
| `TEAM_HUB_LOGGING_FILE`          | `/var/log/team-hub/team-hub.log` | Log file path                                                              |
| `TEAM_HUB_LOGGING_CONSOLE`       | `true`                           | Write logs to the terminal                                                 |

Logging env vars are applied at process startup. Restart the container after changing them.

## Troubleshooting

### Container exits during startup

Check `docker compose logs` or `docker logs team-hub`. Bundled Postgres + Redis + Node need at least **2 GiB** RAM. Ensure `PGDATA` (`/var/lib/postgresql/data`) is writable.

### `GET /health` fails or connection refused

- Confirm the service listens on the mapped host port (default 8080).
- Wait for startup: migrations and Postgres init can take 30–60 seconds on cold start.

### Protected API routes return 503

Redis is required for auth throttling. Verify Redis is running (bundled) or reachable (external Redis). See [Authentication](/auth).

When `redis.noticeEventsPubSub: true` is set for multi-instance notice SSE fan-out, the notice stream route (`GET /notices/stream`) also requires a healthy Redis connection and returns **503** if pub/sub is unavailable.

### Notice SSE (`GET /notices/stream`) disconnects behind a reverse proxy

Long-lived Server-Sent Events need proxy buffering disabled and extended read timeouts. The bundled Docker image configures Nginx for `/notices/stream` automatically (`proxy_buffering off`, `proxy_read_timeout 1h`, HTTP/1.1).

Self-hosted reverse proxies must apply equivalent settings on the SSE path only — normal REST routes can keep default buffering. HarborClient desktop clients fall back to REST polling when the stream is unavailable.

### Config file not found

The CLI defaults to `server.yaml` in the current directory. In the container pass `/etc/team-hub/server.yaml` with `-c` before the subcommand:

```bash
node /app/dist/cli.js -c /etc/team-hub/server.yaml user list
```

## Related guides

- [npm CLI](/deploy/npm) — optional Compose wrapper
- [VPS](/deploy/vps) — Linux host install and day-two ops
- [Google Cloud Run](/deploy/gcp) — managed serverless deploy
