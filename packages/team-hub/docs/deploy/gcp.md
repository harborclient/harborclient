# Google Cloud Run

Deploy Team Hub to [Google Cloud Run](https://cloud.google.com/run) when you want a managed, scale-to-zero HTTP service.

> [!WARNING]
> Cloud Run container storage is **ephemeral**. Bundled Postgres data is lost when the revision is redeployed or the instance is recycled. Use bundled services only for evaluation. For production, disable them and use **Cloud SQL** (Postgres) and **Memorystore** (Redis).

Pull the prebuilt image from GHCR — see [Deploy overview](/deploy/) for tags.

## Prerequisites

- A GCP project with billing enabled
- [`gcloud`](https://cloud.google.com/sdk/docs/install) CLI authenticated to your project
- Ability to pull `ghcr.io/harborclient/team-hub` (public package, or authenticated if private)

Enable required APIs:

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com redis.googleapis.com secretmanager.googleapis.com vpcaccess.googleapis.com
```

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
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --allow-unauthenticated
```

- `--min-instances 1` keeps one warm instance so bundled Postgres is less likely to restart mid-session. Data is still not durable across redeploys.
- Omit `--allow-unauthenticated` if the service should require authentication at the Cloud Run / IAP layer.

Verify health:

```bash
curl -s "$(gcloud run services describe team-hub --region "${REGION}" --format='value(status.url)')/health"
```

## Production

Point Team Hub at managed Postgres and Redis and disable the bundled processes.

### Environment variables

| Variable                  | Production value              | Notes                  |
| ------------------------- | ----------------------------- | ---------------------- |
| `TEAM_HUB_START_POSTGRES` | `false`                       | Use Cloud SQL          |
| `TEAM_HUB_START_REDIS`    | `false`                       | Use Memorystore        |
| `TEAM_HUB_DB_HOST`        | Cloud SQL host or socket path | See Cloud SQL section  |
| `TEAM_HUB_DB_PORT`        | `5432`                        |                        |
| `TEAM_HUB_DB_USER`        | your DB user                  |                        |
| `TEAM_HUB_DB_PASSWORD`    | from Secret Manager           |                        |
| `TEAM_HUB_DB_DATABASE`    | your database name            |                        |
| `TEAM_HUB_REDIS_HOST`     | Memorystore IP                | Requires VPC connector |
| `TEAM_HUB_REDIS_PORT`     | `6379`                        |                        |

Store secrets in [Secret Manager](https://cloud.google.com/secret-manager) and mount them on the Cloud Run service rather than passing passwords on the command line.

Example deploy with external services (adjust hostnames and secret references):

```bash
gcloud run deploy team-hub \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --set-env-vars "TEAM_HUB_START_POSTGRES=false,TEAM_HUB_START_REDIS=false,TEAM_HUB_DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE,TEAM_HUB_DB_USER=teamhub,TEAM_HUB_DB_DATABASE=teamhub,TEAM_HUB_REDIS_HOST=10.0.0.5" \
  --set-secrets "TEAM_HUB_DB_PASSWORD=teamhub-db-password:latest" \
  --add-cloudsql-instances "PROJECT:REGION:INSTANCE" \
  --vpc-connector "projects/PROJECT/locations/REGION/connectors/CONNECTOR"
```

### Cloud SQL (Postgres)

1. Create a Cloud SQL Postgres instance.
2. Create a database and user for Team Hub.
3. Attach the instance to Cloud Run with `--add-cloudsql-instances`.
4. Set `TEAM_HUB_DB_HOST` to the Unix socket path `/cloudsql/PROJECT:REGION:INSTANCE` (Cloud Run mounts this automatically when the instance is attached).

Run migrations before serving traffic. Options:

- Deploy once with a [Cloud Run Job](https://cloud.google.com/run/docs/create-jobs) that runs `node /app/dist/cli.js -c /etc/team-hub/server.yaml migrate` with the same env and Cloud SQL attachment.
- Run migrate from a one-off `docker run` on a machine that can reach the database.

### Memorystore (Redis)

Team Hub requires Redis for [authentication throttling](/auth). Protected routes return **503** when Redis is unreachable.

1. Create a Memorystore for Redis instance in the same VPC region.
2. Configure a [Serverless VPC Access connector](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access).
3. Attach the connector to the Cloud Run service and set `TEAM_HUB_REDIS_HOST` to the instance IP.

### Firestore (alternative database)

To use Firestore instead of Postgres, set `TEAM_HUB_DB_DRIVER=firestore` and mount a service account key (or use workload identity). You still need Redis. See `server.yaml.example` at the package root for the Firestore config shape; map fields to env vars or mount a custom `server.yaml` at `/etc/team-hub/server.yaml`.

### LLM provider keys

Optional LLM proxy settings are not generated from env vars in the default template. For hub-proxied LLM access, mount a config file with an `llm` section or extend deployment tooling. See [LLM](/llm) and `server.yaml.example`.

## Admin commands

On Cloud Run there is no long-lived shell to `exec` into. Run admin commands with a [Cloud Run Job](https://cloud.google.com/run/docs/create-jobs) or a one-off task using the same image, environment variables, and secrets as the service — for example:

```bash
node /app/dist/cli.js -c /etc/team-hub/server.yaml migrate
node /app/dist/cli.js -c /etc/team-hub/server.yaml user create --name ops --role admin
```

## Troubleshooting

### Container exits during startup

Check Cloud Run logs. Common causes:

- **Insufficient memory** — bundled Postgres + Redis + Node need at least **2 GiB** for evaluation deploys.
- **Postgres init failure** — without a volume, first boot should still succeed but data is ephemeral.

### Migration errors

- Ensure the database user can create tables.
- For Cloud SQL, confirm the Cloud SQL Auth proxy / Unix socket attachment is configured.

### Stale data after redeploy

Expected when using bundled Postgres. Switch to Cloud SQL for durable storage.

## Related guides

- [Deploy overview](/deploy/) — image tags and architecture
- [Docker Compose](/deploy/docker) — env var reference and container CLI patterns
- [VPS](/deploy/vps) — persistent self-hosted alternative
