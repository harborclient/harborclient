# Google Cloud Run

Deploy Team Hub to [Google Cloud Run](https://cloud.google.com/run) when you want a managed, scale-to-zero HTTP service with Cloud SQL and Memorystore.

> [!WARNING]
> Cloud Run container storage is **ephemeral**. Bundled Postgres data is lost when the revision is redeployed or the instance is recycled. Use bundled services only for evaluation. For production, disable them and use **Cloud SQL** (Postgres) and **Memorystore** (Redis).

Pull the prebuilt image from GHCR — see [Deploy overview](/deploy/) for tags. For the self-hosted graduation path before Cloud Run, see [VPS — Graduating beyond a single VPS](/deploy/vps#graduating-beyond-a-single-vps) and [Deploy — Scaling journey](/deploy/#scaling-journey).

## Evaluation vs production

| | Evaluation | Production |
| --- | --- | --- |
| Postgres / Redis | Bundled in the container | Cloud SQL + Memorystore |
| Data durability | Ephemeral (lost on redeploy / recycle) | Durable managed services |
| Migrations | On container start (default) | Cloud Run Job; `TEAM_HUB_SKIP_MIGRATE=true` on the service |
| Instances | Single warm instance typical (`--min-instances 1`) | `max-instances` > 1 + `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true` |
| Probes | Optional smoke curls | Startup/readiness → `/readyz`; liveness → `/healthz` |
| Admin ops | N/A (no durable data) | Cloud Run Jobs (no `docker exec`) |
| Memory / CPU | ≥ **2 GiB** / **2** CPU (bundled stack) | Start at **1 GiB** / **1** CPU (app-only) |

## Prerequisites

- A GCP project with billing enabled
- [`gcloud`](https://cloud.google.com/sdk/docs/install) CLI authenticated to your project
- Ability to pull `ghcr.io/harborclient/team-hub` (public package, or authenticated if private)

Enable required APIs:

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com redis.googleapis.com secretmanager.googleapis.com vpcaccess.googleapis.com
```

For optional avatar object storage (`storage.driver: gcs`), also enable Cloud Storage and grant the Cloud Run service account object read/write on the bucket. Prefer Workload Identity / ADC over mounting a JSON key. See [Configuration — storage](/configuration#storage).

## Pull the image

```bash
export REGION=us-central1
export IMAGE=ghcr.io/harborclient/team-hub:latest

docker pull "${IMAGE}"
# Or build locally for development:
# docker build -f packages/team-hub/Dockerfile -t team-hub:local .
```

For Cloud Run you can reference the GHCR image directly if the service can pull it, or copy the image into Artifact Registry in your project.

## Quick start (evaluation)

Deploy with bundled Postgres and Redis for a quick trial. **Do not rely on this for production data.**

```bash
gcloud run deploy team-hub \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --execution-environment gen2 \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --allow-unauthenticated
```

- `--min-instances 1` keeps one warm instance so bundled Postgres is less likely to restart mid-session. Data is still not durable across redeploys.
- First boot can take **30–60 seconds** (Postgres init + migrate) before `/readyz` passes.
- Omit `--allow-unauthenticated` if the service should require authentication at the Cloud Run / IAP layer.

Verify health:

```bash
SERVICE_URL="$(gcloud run services describe team-hub --region "${REGION}" --format='value(status.url)')"
curl -s "${SERVICE_URL}/healthz"
curl -s "${SERVICE_URL}/readyz"
```

## Production

Point Team Hub at managed Postgres and Redis and disable the bundled processes.

### Architecture

```text
Client
  └─► Cloud Run (Nginx :8080 → Fastify :8787)
          ├─► Cloud SQL Postgres (Unix socket /cloudsql/…)
          └─► Memorystore Redis (Serverless VPC Access connector)
```

The image’s Nginx already disables buffering and sets long read timeouts for `GET /notices/stream`. Unlike [Kubernetes](/deploy/k8s), you do not need a separate Ingress for SSE — the **Cloud Run request timeout** (`--timeout`) is the platform limit that matters for long-lived streams.

### Production checklist

1. Create **Cloud SQL** (Postgres), **Memorystore** (Redis), a **Serverless VPC Access** connector, and Secret Manager secrets (`TEAM_HUB_DB_PASSWORD`, and others as needed).
2. Create a Cloud Run **migrate Job** with the same image, env, secrets, Cloud SQL attachment, and VPC connector as the service (see [Migrations via Cloud Run Job](#migrations-via-cloud-run-job)).
3. Execute the Job and confirm success **before** sending traffic to a new schema.
4. Deploy the Cloud Run **service** with bundled services disabled, production env vars, probes, concurrency, and timeout tuned (see [Deploy example](#deploy-example)).
5. Verify `/healthz`, `/readyz`, a smoke API call, and notice SSE from an authenticated HarborClient client.
6. Optionally wire [Managed Service for Prometheus](https://cloud.google.com/stackdriver/docs/managed-prometheus) scrapes and log-based alerts (see [Observability](#observability)).

### Health probes

Team Hub exposes Kubernetes-style probes on the Nginx port (`--port 8080`). See [API Endpoints — Health](/endpoints#health).

| Probe | Path | Role |
| ----- | ---- | ---- |
| Startup | `/readyz` (recommended for production) | Instance must reach DB + Redis before Cloud Run treats it as started |
| Liveness | `/healthz` | Process is up; **do not** fail on Redis/DB outages (that would restart a healthy process) |
| Readiness | `/readyz` | Stop routing when DB, Redis, or (when enabled) notice pub/sub is down; also **503** during graceful shutdown |
| Legacy | `/health` | Same shallow payload as `/healthz`; keep for older clients — not for orchestrator probes |

Cloud Run can send traffic as soon as the **startup** probe passes. Prefer `/readyz` for startup in production so instances with a dead Cloud SQL or Memorystore connection do not receive traffic. Use Gen2 and `KEY=VALUE` probe flags:

```bash
--execution-environment gen2 \
--startup-probe=httpGet.path=/readyz,httpGet.port=8080,periodSeconds=5,timeoutSeconds=2,failureThreshold=36 \
--liveness-probe=httpGet.path=/healthz,httpGet.port=8080,periodSeconds=10,timeoutSeconds=2,failureThreshold=3 \
--readiness-probe=httpGet.path=/readyz,httpGet.port=8080,periodSeconds=5,timeoutSeconds=2,failureThreshold=3
```

`failureThreshold=36` with `periodSeconds=5` allows about **3 minutes** for cold Cloud SQL / VPC connector paths during startup. Tune downward once your region’s cold-start times are known.

### Environment variables

| Variable | Production value | Notes |
| -------- | ---------------- | ----- |
| `TEAM_HUB_START_POSTGRES` | `false` | Use Cloud SQL |
| `TEAM_HUB_START_REDIS` | `false` | Use Memorystore |
| `TEAM_HUB_SKIP_MIGRATE` | `true` | Run migrate via Job; avoid DDL races when scaling |
| `TEAM_HUB_DB_HOST` | Cloud SQL host or socket path | See [Cloud SQL](#cloud-sql-postgres) |
| `TEAM_HUB_DB_PORT` | `5432` | |
| `TEAM_HUB_DB_USER` | your DB user | |
| `TEAM_HUB_DB_PASSWORD` | from Secret Manager | |
| `TEAM_HUB_DB_DATABASE` | your database name | |
| `TEAM_HUB_DB_MAX` | e.g. `10` | Pool size **per instance**; see [capacity](#scaling-concurrency-and-capacity) |
| `TEAM_HUB_DB_SSL` | `true` when required | Object CA/cert settings need a mounted `server.yaml` |
| `TEAM_HUB_DB_IDLE_TIMEOUT_MILLIS` | optional | Pool idle timeout |
| `TEAM_HUB_DB_CONNECTION_TIMEOUT_MILLIS` | optional | Pool connect timeout |
| `TEAM_HUB_REDIS_HOST` | Memorystore IP | Requires VPC connector |
| `TEAM_HUB_REDIS_PORT` | `6379` | |
| `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB` | `true` | Required for multi-instance notice SSE fan-out |
| `TEAM_HUB_LOGGING_FORMAT` | `json` (default) | Structured logs for Cloud Logging |
| `TEAM_HUB_LOGGING_CONSOLE` | `true` (default) | Stdout → Cloud Logging |
| `TEAM_HUB_METRICS_ENABLED` | `true` (default) | Prometheus `/metrics` |
| `TEAM_HUB_METRICS_AUTH_TOKEN` | optional secret | Protect `/metrics` when scrapers are not on a private network |
| `TEAM_HUB_SHUTDOWN_TIMEOUT_MS` | `8000` | Force-exit after SIGTERM; Cloud Run allows ~**10s** before SIGKILL — keep this **below** 10s |
| `TEAM_HUB_FORCE_CONFIG_GENERATE` | usually unset | Each new instance has empty ephemeral disk and copies the template to `/etc/team-hub/server.yaml`. Set `true` once if you mount a volume over `/etc/team-hub` and need the template rewritten |

Store secrets in [Secret Manager](https://cloud.google.com/secret-manager) and mount them with `--set-secrets` (for example `--set-secrets=TEAM_HUB_DB_PASSWORD=db-password:latest`). The default template keeps `password: ${TEAM_HUB_DB_PASSWORD}` on disk; Node resolves the secret from the process environment at load and on reload.

Full env → `server.yaml` mapping: [Configuration — Docker environment variables](/configuration#docker-environment-variables) and [Environment variable interpolation](/configuration#environment-variable-interpolation). For Memorystore **AUTH**, uncomment `redis.password: ${TEAM_HUB_REDIS_PASSWORD:-}` in a mounted YAML (or the image template) and inject the password as an env secret. Prefer console JSON logs for Cloud Logging; the default file path under `/var/log/team-hub/` is ephemeral and optional.

### Scaling, concurrency, and capacity

#### `--min-instances`

| Value | Effect |
| ----- | ------ |
| `0` | Scale-to-zero; cold starts; open notice SSE streams disconnect (HarborClient falls back to REST polling) |
| `≥ 1` | Recommended for production teams that rely on notice streams or low-latency API |

#### `--max-instances`

Budget database connections against the **peak** instance count, not the current one:

```text
max_instances × TEAM_HUB_DB_MAX ≤ max_connections × 0.75
```

Worked example with Cloud SQL `max_connections = 100` and `TEAM_HUB_DB_MAX=10`:

```text
budget ≈ 75
max_instances × 10 ≤ 75  →  max_instances ≤ 7
```

Leave headroom for the migrate Job and admin sessions. Raise Cloud SQL `max_connections` (instance flags) or lower `TEAM_HUB_DB_MAX` / `max-instances` if the math does not fit. See [Configuration — Pool sizing](/configuration#pool-sizing).

Each instance also uses a Redis throttle client plus notice pub/sub (publisher + subscriber when `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true`). Size the Memorystore tier / `maxclients` for your `max-instances` peak.

#### `--concurrency`

Cloud Run’s default is **80** concurrent requests per instance. Long-lived SSE connections (`GET /notices/stream`) count toward concurrency and can starve REST capacity on a busy instance.

| Workload | Starting `--concurrency` |
| -------- | ------------------------ |
| Mixed REST + notice SSE | **10–20** |
| SSE-heavy (few REST calls) | as low as **1** (scales out with `max-instances`) |
| REST-only / polling clients | higher values are fine |

Prefer more instances at moderate concurrency over a few instances at very high concurrency when SSE is in use.

#### `--timeout`

Request timeout is how long a **single HTTP request** may run (default 5 minutes; Gen2 up to **3600** seconds). Set this high enough for notice SSE (for example `--timeout 3600`). Bundled Nginx uses a 1h read timeout internally, but the Cloud Run platform timeout is authoritative.

This is separate from **instance termination**. Cloud Run sends `SIGTERM` and allows about **10 seconds** before `SIGKILL`. Team Hub drains notice SSE streams, fails `/readyz` immediately, then disconnects DB/Redis/MCP within `TEAM_HUB_SHUTDOWN_TIMEOUT_MS` — set that to **8000** (or similar) on Cloud Run so the process exits before SIGKILL. See [Docker Compose — Graceful shutdown](/deploy/docker#graceful-shutdown).

#### CPU and memory

| Path | Starting point |
| ---- | -------------- |
| Evaluation (bundled Postgres + Redis) | **2** CPU / **2 GiB** |
| Production (app-only) | **1** CPU / **1–2 GiB** |

Raise memory if you see OOM kills under concurrent LLM/MCP work.

### Deploy example

Adjust project, region, hosts, and secret names:

```bash
gcloud run deploy team-hub \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --execution-environment gen2 \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 5 \
  --concurrency 20 \
  --timeout 3600 \
  --startup-probe=httpGet.path=/readyz,httpGet.port=8080,periodSeconds=5,timeoutSeconds=2,failureThreshold=36 \
  --liveness-probe=httpGet.path=/healthz,httpGet.port=8080,periodSeconds=10,timeoutSeconds=2,failureThreshold=3 \
  --readiness-probe=httpGet.path=/readyz,httpGet.port=8080,periodSeconds=5,timeoutSeconds=2,failureThreshold=3 \
  --set-env-vars "TEAM_HUB_START_POSTGRES=false,TEAM_HUB_START_REDIS=false,TEAM_HUB_SKIP_MIGRATE=true,TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true,TEAM_HUB_DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE,TEAM_HUB_DB_USER=teamhub,TEAM_HUB_DB_DATABASE=teamhub,TEAM_HUB_DB_MAX=10,TEAM_HUB_REDIS_HOST=10.0.0.5,TEAM_HUB_LOGGING_FORMAT=json,TEAM_HUB_SHUTDOWN_TIMEOUT_MS=8000" \
  --set-secrets "TEAM_HUB_DB_PASSWORD=teamhub-db-password:latest" \
  --add-cloudsql-instances "PROJECT:REGION:INSTANCE" \
  --vpc-connector "projects/PROJECT/locations/REGION/connectors/CONNECTOR"
```

Omit `--allow-unauthenticated` when the service should require Cloud Run / IAP authentication.

### Cloud SQL (Postgres)

1. Create a Cloud SQL Postgres instance.
2. Create a database and user for Team Hub.
3. Attach the instance to Cloud Run with `--add-cloudsql-instances`.
4. Set `TEAM_HUB_DB_HOST` to the Unix socket path `/cloudsql/PROJECT:REGION:INSTANCE` (Cloud Run mounts this automatically when the instance is attached).
5. Set `TEAM_HUB_DB_MAX` so `max-instances × pool size` stays under Cloud SQL `max_connections` (leave ~25% headroom). Raise `max_connections` via Cloud SQL database flags when needed. See [Configuration — Pool sizing](/configuration#pool-sizing).

Team Hub must use the Cloud SQL **primary** (writer) connection name or IP — not a read replica. Cloud SQL replicas are useful for analytics or backups outside the app; the Team Hub process has no `db.readHost` and sends all queries (including auth lookups and migrations) to `TEAM_HUB_DB_HOST`. At high `max-instances`, consider Cloud SQL Auth Proxy or PgBouncer in front of the primary for connection multiplexing. See [Configuration — Read replicas and connection pooling](/configuration#read-replicas-and-connection-pooling).

### Migrations via Cloud Run Job

Run migrations **once** before serving traffic (do not rely on app instances to migrate when `max-instances` > 1). Set `TEAM_HUB_SKIP_MIGRATE=true` on the Cloud Run **service**.

The image `ENTRYPOINT` starts supervisord. For Jobs, override the command, **copy** the config template (placeholders stay in the file), and let the CLI resolve `${TEAM_HUB_*}` from the Job environment (the same pattern as the [Kubernetes migrate Job](https://github.com/harborclient/harborclient/blob/main/packages/team-hub/deploy/k8s/base/migrate-job.yaml)).

Create the Job (adjust project, region, hosts, and secrets). The `--args` value is a single bash `-c` script so commas inside do not confuse `gcloud`:

```bash
MIGRATE_SCRIPT=$(cat <<'EOF'
set -euo pipefail
mkdir -p /etc/team-hub
cp /docker/server.yaml.template /etc/team-hub/server.yaml
node /app/dist/cli.js -c /etc/team-hub/server.yaml migrate
EOF
)

gcloud run jobs create team-hub-migrate \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --tasks 1 \
  --max-retries 1 \
  --task-timeout 10m \
  --memory 512Mi \
  --cpu 1 \
  --set-cloudsql-instances "PROJECT:REGION:INSTANCE" \
  --vpc-connector "projects/PROJECT/locations/REGION/connectors/CONNECTOR" \
  --set-env-vars "TEAM_HUB_START_POSTGRES=false,TEAM_HUB_START_REDIS=false,TEAM_HUB_DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE,TEAM_HUB_DB_USER=teamhub,TEAM_HUB_DB_DATABASE=teamhub,TEAM_HUB_DB_MAX=10,TEAM_HUB_REDIS_HOST=10.0.0.5,TEAM_HUB_LOGGING_CONSOLE=true,TEAM_HUB_LOGGING_FORMAT=json" \
  --set-secrets "TEAM_HUB_DB_PASSWORD=teamhub-db-password:latest" \
  --command /bin/bash \
  --args=-c \
  --args="${MIGRATE_SCRIPT}"

gcloud run jobs execute team-hub-migrate --region "${REGION}" --wait
```

Alternatively, run migrate from a one-off `docker run` on a machine that can reach the database (Cloud SQL Auth Proxy or public IP with restricted network).

### Memorystore (Redis)

Team Hub requires Redis for [authentication throttling](/auth). Protected routes return **503** when Redis is unreachable.

1. Create a Memorystore for Redis instance in the same VPC region.
2. Configure a [Serverless VPC Access connector](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access).
3. Attach the connector to the Cloud Run service and set `TEAM_HUB_REDIS_HOST` to the instance IP.
4. Set `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true` so notice SSE (`GET /notices/stream`) fans out across Cloud Run instances that share Memorystore. Without it, each instance only broadcasts notices in-memory.
5. Size the Memorystore tier for `max-instances` (throttle client + pub/sub connections per instance). If you enable Redis AUTH, mount a custom `server.yaml` with `redis.password` — the default Docker template does not map a Redis password env var.

### Notice SSE on Cloud Run

- When `max-instances` > 1, set `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true` (shared Memorystore).
- Set `--timeout` high enough for long streams (up to **3600s** on Gen2).
- Nginx in the image already disables buffering for `/notices/stream`; no extra Ingress annotations are required.
- Session affinity is **not** required — Redis pub/sub fans events to every instance. Uneven `team_hub_sse_connections` across instances is normal.
- HarborClient desktop clients fall back to REST polling when the stream disconnects (scale-to-zero, timeout, or recycle). See [Docker Compose — Notice SSE](/deploy/docker#notice-sse-get-noticesstream-disconnects-behind-a-reverse-proxy).

### Firestore (alternative database)

To use Firestore instead of Postgres, set `TEAM_HUB_DB_DRIVER=firestore` and mount a service account key (or use workload identity). You still need Redis. See `server.yaml.example` at the package root for the Firestore config shape; map fields to env vars or mount a custom `server.yaml` at `/etc/team-hub/server.yaml`.

### LLM provider keys

Optional LLM proxy settings are commented in the default template. For hub-proxied LLM access, mount a `server.yaml` with an `llm` section that references `${TEAM_HUB_LLM_OPENAI_API_KEY}` (or similar) and inject those values with `--set-secrets`. See [LLM](/llm), [Environment variable interpolation](/configuration#environment-variable-interpolation), and `server.yaml.example`.

## Upgrades

1. Pin or pull the new image tag (`ghcr.io/harborclient/team-hub:<version>`).
2. When the release includes schema changes, update the migrate Job image (`gcloud run jobs update team-hub-migrate --image …`) and execute it; wait for success.
3. Deploy a new service revision with the same image and env (`gcloud run deploy …` or `gcloud run services update …`).
4. Confirm `/readyz` on the service URL and watch Cloud Logging for startup errors.

Serving revisions keep `TEAM_HUB_SKIP_MIGRATE=true` so parallel instances never race on DDL.

## Admin commands

On Cloud Run there is **no** long-lived shell to `docker exec` into. Run admin commands with a [Cloud Run Job](https://cloud.google.com/run/docs/create-jobs) (or a one-off `docker run` that can reach Cloud SQL) using the same image, environment variables, secrets, Cloud SQL attachment, and VPC connector as the service.

Copy the config template the same way as the migrate Job (`cp /docker/server.yaml.template /etc/team-hub/server.yaml`), ensure Job env/secrets match the service, then invoke the CLI. Examples:

```bash
node /app/dist/cli.js -c /etc/team-hub/server.yaml migrate
node /app/dist/cli.js -c /etc/team-hub/server.yaml user create --name ops --role admin
node /app/dist/cli.js -c /etc/team-hub/server.yaml token create --user ops
```

Create a reusable admin Job (override `--args` / re-create when the subcommand changes), or execute a one-shot Job per operation. See [CLI](/cli).

## Observability

### Logs

`TEAM_HUB_LOGGING_FORMAT=json` (default) writes structured lines to stdout → Cloud Logging. Prefer console logging over the ephemeral file under `/var/log/team-hub/`. Query by severity and JSON fields (`reqId`, route, duration) in Logs Explorer.

### Metrics

Team Hub exposes Prometheus text at `GET /metrics` on port **8080**. Prefer [Google Cloud Managed Service for Prometheus](https://cloud.google.com/stackdriver/docs/managed-prometheus) or an in-VPC scraper — **do not** expose `/metrics` on a public unauthenticated service URL. Optional scrape auth: set `TEAM_HUB_METRICS_AUTH_TOKEN` and configure the scraper Bearer token to match.

Series worth watching:

- `team_hub_sse_connections` — open notice streams per instance
- `team_hub_db_pool_connections{state="waiting"}` — pool pressure
- `team_hub_auth_throttled_total` — auth / invitation throttle hits

See [Configuration — metrics](/configuration#metrics) and [alert ideas](/configuration#alert-ideas).

## Troubleshooting

### Container exits during startup

Check Cloud Run logs. Common causes:

- **Insufficient memory** — bundled Postgres + Redis + Node need at least **2 GiB** for evaluation deploys.
- **Postgres init failure** — without a volume, first boot should still succeed but data is ephemeral.
- **Startup probe failures** — `/readyz` cannot reach Cloud SQL or Memorystore; confirm `--add-cloudsql-instances`, VPC connector, and env hosts. Increase startup `failureThreshold` for slow cold paths.

### `GET /readyz` returns 503

Readiness fails when the database, Redis, or (when enabled) notice pub/sub is unreachable, or during graceful shutdown. Inspect the `checks` object in the JSON body (`db`, `redis`, `noticeEvents`) and Cloud Logging:

```bash
gcloud run services logs read team-hub --region "${REGION}" --limit 100
```

Confirm Cloud SQL socket attachment, Memorystore IP, and VPC connector egress.

### Protected API routes return 503

Redis is required for auth throttling. Verify Memorystore reachability through the VPC connector. See [Authentication](/auth).

### Notice SSE disconnects

- `--timeout` too low for long streams (raise toward **3600** on Gen2).
- `--min-instances 0` recycled the instance (clients fall back to polling).
- Missing `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true` when `max-instances` > 1 (other instances never see publishes).
- See [Docker Compose — Notice SSE](/deploy/docker#notice-sse-get-noticesstream-disconnects-behind-a-reverse-proxy).

### Migration Job failures

```bash
gcloud run jobs executions list --job team-hub-migrate --region "${REGION}"
gcloud run jobs executions describe EXECUTION --region "${REGION}"
# Then open the linked Cloud Logging entries for the failed task
```

Common causes: wrong DB password, missing Cloud SQL attachment / VPC connector, TLS required (`TEAM_HUB_DB_SSL=true`), or config render failed because env vars were unset. Fix secrets/env, update the Job, and execute again.

### Stale config after env change

Cloud Run instances usually start with empty ephemeral disk, so `/etc/team-hub/server.yaml` is copied from the template on each new instance. Env and secret changes that create a **new revision** are resolved at process start from placeholders in that file. If you mount a volume over `/etc/team-hub` (or otherwise preserve a file without placeholders), set `TEAM_HUB_FORCE_CONFIG_GENERATE=true` once so the entrypoint rewrites the template.

### Stale data after redeploy

Expected when using bundled Postgres. Switch to Cloud SQL for durable storage.

## Related guides

- [Deploy overview](/deploy/) — image tags, bundled vs managed services, scaling journey
- [Docker Compose](/deploy/docker) — env var reference and container CLI patterns
- [Docker Compose — External Postgres and Redis](/deploy/docker#external-postgres-and-redis) — app-only Compose equivalent
- [Kubernetes](/deploy/k8s) — multi-replica Deployment + migrate Job alternative
- [VPS — Graduating beyond a single VPS](/deploy/vps#graduating-beyond-a-single-vps) — path from a single box to managed platforms
- [Configuration](/configuration) — `server.yaml` mapping and pool sizing
