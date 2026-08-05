# npm CLI

The `@harborclient/team-hub` npm package includes an optional deployment CLI under `team-hub deploy`. It wraps Docker Compose around the prebuilt GHCR image.

> [!IMPORTANT]
> The npm package is **not** the production application artifact. Docker remains the runtime and process manager. Advanced operators can ignore this CLI and use [Docker Compose](/deploy/docker) directly.

## Prerequisites

- Node.js 24+
- Docker Engine and the Compose plugin on the same machine
- Access to pull `ghcr.io/harborclient/team-hub` (public package, or authenticated if private)

Verify the CLI includes deploy commands:

```bash
team-hub --help
```

`deploy` must appear under **Commands**. If you see `error: unknown command 'deploy'`, upgrade:

```bash
npm install --global @harborclient/team-hub@latest
```

## Install and start

```bash
npm install --global @harborclient/team-hub

team-hub deploy install
team-hub deploy status
```

`deploy install`:

1. Verifies `docker` and `docker compose` are available.
2. Creates a managed deployment directory (default `~/.config/team-hub`).
3. Writes `compose.yaml` from the bundled template.
4. Creates `.env` from `.env.example` **only when `.env` does not already exist** (never overwrites).
5. Pulls the configured GHCR image and starts the stack.

Override the deployment directory with `--dir <path>` or `TEAM_HUB_DEPLOY_DIR`. Select an image tag with `--version <tag>` (defaults to the CLI package version).

## Commands

| Command | Behavior |
| ------- | -------- |
| `team-hub deploy install` | Prepare files, pull image, start |
| `team-hub deploy start` | `docker compose up -d --remove-orphans` |
| `team-hub deploy stop` | `docker compose stop` (keeps volumes) |
| `team-hub deploy restart` | Recreate with `--force-recreate --remove-orphans` |
| `team-hub deploy update` | Pull image and recreate; preserves `.env` and volumes |
| `team-hub deploy status` | Docker availability, container state, health, image refs |
| `team-hub deploy logs [--tail N]` | Follow Compose logs |
| `team-hub deploy version` | CLI version plus configured/running image |
| `team-hub deploy uninstall` | Stop/remove containers; keep files and volumes |
| `team-hub deploy uninstall --purge` | Also delete deployment files and named volumes (confirm, or pass `--yes`) |

Examples:

```bash
team-hub deploy logs --tail 200
team-hub deploy update
team-hub deploy uninstall --purge --yes
```

## What the CLI does not do

- Build the application Docker image locally
- Run `npm install -g` to update itself (update the npm package separately)
- Start the Node server as a host daemon without Docker

## Admin commands after install

Deployment management uses `team-hub deploy …` on the host. Application administration (`user create`, `migrate`, …) still runs **inside** the container — see [Docker Compose — Using the CLI in the container](/deploy/docker#using-the-cli-in-the-container).

## Related guides

- [Docker Compose](/deploy/docker) — direct Compose deployment without the CLI
- [VPS](/deploy/vps) — Linux host install details
- [Deploy overview](/deploy/) — image tags and architecture
