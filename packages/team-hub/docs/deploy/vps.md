# VPS

Run Team Hub on a plain Linux VPS when you want a simple, always-on server with persistent storage. Bundled Postgres and Redis work well on a VPS **when you mount a Docker volume** for `/var/lib/postgresql/data`.

This guide uses a generic Debian or Ubuntu VPS. [OVHcloud](https://www.ovhcloud.com/) is a common choice; their [Docker install guide](https://docs.ovhcloud.com/en/guides/bare-metal-cloud/virtual-private-servers/install-docker-on-vps) matches the checklist here.

For Compose and env details shared by all hosts, see [Docker Compose](/deploy/docker). For the optional npm wrapper, see [npm CLI](/deploy/npm).

## Overview

1. Install Docker on the host.
2. Pull the prebuilt GHCR image (Compose or `team-hub deploy install`).
3. Run with a named volume, restart policy, and a strong database password.
4. Open the HTTP port in the host firewall.
5. Create an admin user via `docker exec`.

This guide covers HTTP. Add a reverse proxy and TLS on the host if you need HTTPS.

## Prerequisites

- A VPS with at least **2 GiB RAM** (bundled Postgres, Redis, and Node need headroom). See [Sizing and capacity](#sizing-and-capacity) for growing and heavy tiers.
- SSH access with a user that has `sudo` privileges
- Debian 11/12 or Ubuntu 22.04 and later

## Install Docker

Follow your provider's guide or the OVHcloud Docker tutorial. Summary for Ubuntu 22.04:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
```

Avoid running routine Docker commands with `sudo` — root-owned files in volumes can cause permission errors later.

Verify:

```bash
docker --version
docker compose version
docker run hello-world
```

## Deploy

### Docker Compose (recommended)

```bash
mkdir -p ~/team-hub && cd ~/team-hub

curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.yaml
curl -fsSLO https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/.env.example
cp .env.example .env
```

Edit `.env`:

- `APP_VERSION` — released tag such as `0.8.0` or `latest`
- `HOST_PORT` — host port (for example `80` or `8080`)
- `TEAM_HUB_DB_PASSWORD` — strong secret

Then:

```bash
docker compose pull
docker compose up -d --remove-orphans
docker compose logs -f
```

See [Docker Compose](/deploy/docker) for updates, rollbacks, and authentication.

### Optional npm CLI

```bash
npm install --global @harborclient/team-hub
team-hub deploy install
```

See [npm CLI](/deploy/npm).

### docker run alternative

```bash
docker pull ghcr.io/harborclient/team-hub:latest

docker run -d \
  --name team-hub \
  --restart unless-stopped \
  -p 80:8080 \
  -v team-hub-pgdata:/var/lib/postgresql/data \
  --env-file .env \
  ghcr.io/harborclient/team-hub:latest
```

## Verify and create users

```bash
curl -s http://VPS_IP/healthz
curl -s http://VPS_IP/readyz
# or, on the VPS itself with HOST_PORT=8080:
curl -s http://127.0.0.1:8080/healthz
curl -s http://127.0.0.1:8080/readyz
```

Create the first admin, then a desktop user:

```bash
docker exec -it team-hub \
  node /app/dist/cli.js -c /etc/team-hub/server.yaml user create --name ops --role admin

docker exec -it team-hub \
  node /app/dist/cli.js -c /etc/team-hub/server.yaml user create --name alice --role user \
  --collection-access '*' --environment-access '*'
```

Copy each one-time `hbk_…` token immediately. Connect HarborClient to `http://VPS_IP` (and the mapped port if not 80). See [Authentication](/auth) and [CLI](/cli).

## Persistence and backups

The `team-hub-pgdata` volume survives `docker stop`, `docker rm`, and image updates as long as you reuse the same volume name.

For disaster recovery:

- Enable provider snapshots if available (for example OVH VPS snapshots).
- Periodically back up the volume or use `pg_dump` from inside the container.

## Firewall

Allow inbound HTTP to the mapped port. On Ubuntu with UFW (example host port `80`):

```bash
sudo ufw allow 80/tcp
sudo ufw enable
sudo ufw status
```

Also open the same port in your provider's network firewall if present.

## Updates

```bash
# Edit APP_VERSION in .env if needed
docker compose pull
docker compose up -d --remove-orphans
```

Or `team-hub deploy update` when using the npm CLI. On a single VPS, migrations run automatically on start (`TEAM_HUB_SKIP_MIGRATE` defaults to `false`). That is the recommended setting for one container.

If you later run multiple Team Hub containers against one database, set `TEAM_HUB_SKIP_MIGRATE=true` on the serving instances and run migrate once before scaling — see [Docker Compose — Multi-instance migrations and notice fan-out](/deploy/docker#multi-instance-migrations-and-notice-fan-out) and [Graduating beyond a single VPS](#graduating-beyond-a-single-vps).

## Edit configuration

On first boot the entrypoint copies the image `server.yaml` template to `/etc/team-hub/server.yaml` with `${TEAM_HUB_*}` placeholders. The Node process resolves those placeholders from the container environment at load and on each reload — secrets are not written into the on-disk YAML. Later edits inside the container survive `docker restart`. To replace the file from the image template again, set `TEAM_HUB_FORCE_CONFIG_GENERATE=true` once.

Changing Compose/`.env` secret values (for example `TEAM_HUB_DB_PASSWORD`) takes effect after a Team Hub process restart, or after `SIGHUP` / `POST /admin/config/reload` for reloadable sections — you do not need to force-regenerate the YAML when it still contains placeholders.

```bash
docker exec -it team-hub nano /etc/team-hub/server.yaml
```

Apply changes:

- Reloadable sections (`db`, `redis`, `llm`, `plugins`) — `POST /admin/config/reload` or `SIGHUP`
- Bind/logging changes — `docker exec team-hub /docker/restart-team-hub.sh`

To persist config across container recreation, bind-mount a host file to `/etc/team-hub/server.yaml` (optionally with `${…}` placeholders for secrets). See [Docker Compose — Using the CLI in the container](/deploy/docker#using-the-cli-in-the-container) and [Configuration — Environment variable interpolation](/configuration#environment-variable-interpolation).

A single VPS with the bundled database usually leaves `db.max` unset (driver default). If you later move Postgres to a managed instance and run multiple Team Hub containers, set `db.max` / `TEAM_HUB_DB_MAX` so total pool connections stay under the database limit — see [Configuration — Pool sizing](/configuration#pool-sizing).

## Sizing and capacity

Use these starting points for a **single VPS** with the bundled Postgres + Redis image. Tune from metrics after you have real traffic.

| Profile | Team size (approx.) | VPS RAM | CPU | Disk | Notes |
| ------- | ------------------- | ------- | --- | ---- | ----- |
| Small | ≤ ~20 active users | 2 GiB | 1 vCPU | 20+ GiB SSD | Default bundled stack; matches the prerequisite above |
| Growing | ~20–80 users | 4 GiB | 2 vCPU | 40+ GiB SSD | More headroom for Postgres cache, Redis, and LLM proxying |
| Heavy | 80+ users or heavy LLM | 8 GiB | 2–4 vCPU | Fast SSD / NVMe | Prefer [graduating](#graduating-beyond-a-single-vps) before this tier feels tight |

**Bundled Postgres limits** on a single container:

- One container is one Postgres instance — no read replicas and no external pooler beyond the Node driver default.
- Avatars and collection data live in the same database, so disk use grows with team content.
- Vertical resize (more RAM/CPU on the same VPS, keep the `team-hub-pgdata` volume) is the first lever and needs no app config changes. Keep provider snapshots and periodic `pg_dump` backups as in [Persistence and backups](#persistence-and-backups).

## When to scale

Watch these signals on a single box. `GET /metrics` exposes Prometheus series when metrics are enabled (default) — see [Configuration — metrics](/configuration#metrics) and [alert ideas](/configuration#alert-ideas).

| Signal | What it means | Where to look |
| ------ | ------------- | ------------- |
| Sustained high CPU / OOM kills | Postgres, Redis, or Node contending on one box | `docker stats`, host monitoring, container restarts in logs |
| Redis CPU or memory pressure | Auth throttle (and notice pub/sub if enabled) on the same Redis | `redis-cli INFO` inside the container, host `top` |
| DB connection pressure | `too many connections`, slow protected routes | Postgres logs; `team_hub_db_pool_connections{state="waiting"}` on `/metrics` |
| High notice SSE count | Many desktop clients with live streams | `team_hub_sse_connections`; elevated Node memory |
| LLM latency / timeouts | Hub proxying to providers; CPU-bound or upstream slowness | `team_hub_http_request_duration_seconds` on LLM routes |
| Disk full / slow I/O | Bundled Postgres data and logs | `df`, volume growth, `pg_dump` size trends |

**Stay on a single VPS** while a larger plan or lighter tuning (log retention, `db.max` left at driver default, fewer concurrent LLM calls) clears the signal.

**Graduate** when you need high availability, more than one app instance, or managed Postgres/Redis that scale independently of the app container — follow [Graduating beyond a single VPS](#graduating-beyond-a-single-vps).

## Graduating beyond a single VPS

Move off the all-in-one container in stages. Each stage is a valid stopping point; you do not have to finish every step at once.

```text
Single VPS (bundled)
  → external Postgres
  → external Redis
  → 2+ app replicas (Compose + reverse proxy)
  → Cloud Run or Kubernetes
```

| Stage | Action | Key settings | Guide |
| ----- | ------ | ------------ | ----- |
| 1 | Move Postgres to managed or a dedicated host | `TEAM_HUB_START_POSTGRES=false`, `TEAM_HUB_DB_*`; keep a volume/`pg_dump` backup for cutover | [Docker Compose — External Postgres and Redis](/deploy/docker#external-postgres-and-redis) |
| 2 | Move Redis out (required before multi-instance) | `TEAM_HUB_START_REDIS=false`, `TEAM_HUB_REDIS_*` | Same |
| 3 | Enable cross-replica notice fan-out | `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true` | [Multi-instance migrations and notice fan-out](/deploy/docker#multi-instance-migrations-and-notice-fan-out) |
| 4a | Two (or more) app replicas behind a reverse proxy | `TEAM_HUB_SKIP_MIGRATE=true`, migrate once, `compose.external.yaml` with `--scale team-hub=2`, SSE-friendly proxy | [Scale to two or more replicas](/deploy/docker#scale-to-two-or-more-replicas) |
| 4b | Managed orchestration | Same external DB/Redis + notice pub/sub; platform probes and migrate Jobs | [Kubernetes](/deploy/k8s) or [Google Cloud Run](/deploy/gcp) |

### Cutover notes

- Export with `pg_dump` from the bundled Postgres volume, restore on the managed instance, then point `TEAM_HUB_DB_HOST` (and related vars) at the new database.
- Run `migrate` once against the new database before sending traffic (see [Migrate once against external Postgres](/deploy/docker#migrate-once-against-external-postgres)).
- For stage 4a, put Nginx, Caddy, or Traefik in front with a long read timeout and buffering disabled for `/notices/stream` (same idea as the [Kubernetes notices Ingress](https://github.com/harborclient/harborclient/blob/main/packages/team-hub/deploy/k8s/base/ingress-notices.yaml)).
- When scaling replicas, budget connections: `replicas × TEAM_HUB_DB_MAX ≤ max_connections × 0.75` — see [Configuration — Pool sizing](/configuration#pool-sizing).
- After externalizing Postgres, you can add PgBouncer (or a managed pooler) on the same VPC and point `TEAM_HUB_DB_HOST` at it. Read replicas remain an operator concern outside Team Hub — the app has no read/write split. See [Configuration — Read replicas and connection pooling](/configuration#read-replicas-and-connection-pooling).

App-only Compose templates: [`compose.external.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.yaml) and the local smoke stack [`compose.external.reference.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/compose.external.reference.yaml).

## Troubleshooting

### Connection refused from outside the VPS

- Confirm the container is running: `docker compose ps` or `docker ps`
- Check UFW and the provider firewall allow the mapped host port
- Verify locally: `curl -s http://127.0.0.1:8080/healthz` and `curl -s http://127.0.0.1:8080/readyz` (adjust port)

### Container exits during startup

Check `docker compose logs`. Bundled Postgres + Redis + Node need at least **2 GiB** RAM.

### Postgres init or permission errors

Ensure `PGDATA` is on a writable volume. If you previously ran Docker with `sudo`, fix volume ownership or recreate the volume.

## Related guides

- [Docker Compose](/deploy/docker) — Compose templates, external Postgres/Redis, multi-instance
- [Docker Compose — External Postgres and Redis](/deploy/docker#external-postgres-and-redis) — app-only path used in [graduation](#graduating-beyond-a-single-vps)
- [npm CLI](/deploy/npm)
- [Google Cloud Run](/deploy/gcp) — managed alternative after externalizing DB/Redis
- [Kubernetes](/deploy/k8s) — multi-replica Deployment, Ingress, and migrate Job
- [Configuration — Pool sizing](/configuration#pool-sizing), [Read replicas and connection pooling](/configuration#read-replicas-and-connection-pooling), and [metrics](/configuration#metrics)
