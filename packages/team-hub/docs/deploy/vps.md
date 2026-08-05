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

- A VPS with at least **2 GiB RAM** (bundled Postgres, Redis, and Node need headroom)
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
curl -s http://VPS_IP/health
# or, on the VPS itself with HOST_PORT=8080:
curl -s http://127.0.0.1:8080/health
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

Or `team-hub deploy update` when using the npm CLI. Migrations run automatically on start.

## Edit configuration

On first boot the entrypoint generates `/etc/team-hub/server.yaml` from environment variables. Later edits inside the container survive `docker restart`. To regenerate from env vars, set `TEAM_HUB_FORCE_CONFIG_GENERATE=true` once.

```bash
docker exec -it team-hub nano /etc/team-hub/server.yaml
```

Apply changes:

- Reloadable sections (`db`, `redis`, `llm`, `plugins`) — `POST /admin/config/reload` or `SIGHUP`
- Bind/logging changes — `docker exec team-hub /docker/restart-team-hub.sh`

To persist config across container recreation, bind-mount a host file to `/etc/team-hub/server.yaml`. See [Docker Compose — Using the CLI in the container](/deploy/docker#using-the-cli-in-the-container) and [Configuration](/configuration).

## Troubleshooting

### Connection refused from outside the VPS

- Confirm the container is running: `docker compose ps` or `docker ps`
- Check UFW and the provider firewall allow the mapped host port
- Verify locally: `curl -s http://127.0.0.1:8080/health` (adjust port)

### Container exits during startup

Check `docker compose logs`. Bundled Postgres + Redis + Node need at least **2 GiB** RAM.

### Postgres init or permission errors

Ensure `PGDATA` is on a writable volume. If you previously ran Docker with `sudo`, fix volume ownership or recreate the volume.

## Related guides

- [Docker Compose](/deploy/docker)
- [npm CLI](/deploy/npm)
- [Google Cloud Run](/deploy/gcp)
