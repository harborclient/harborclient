# Team Hub — Kubernetes example

Minimal production-shaped manifests for running **≥2 replicas** of Team Hub against **external Postgres and Redis**.

Full guide: [Kubernetes deploy docs](../../docs/deploy/k8s.md) (also published under Deploy → Kubernetes on the Team Hub docs site).

## Prerequisites

- Kubernetes cluster with the [nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/) (or equivalent with SSE-friendly settings)
- Reachable Postgres and Redis (not the bundled processes inside the image)
- Ability to pull `ghcr.io/harborclient/team-hub`

## Quick start

```bash
# From this directory (packages/team-hub/deploy/k8s)
cd packages/team-hub/deploy/k8s

# 1. Edit base/configmap.yaml (DB/Redis hosts, TEAM_HUB_DB_MAX, etc.)
# 2. Create the Secret (preferred over secret.example.yaml):
kubectl apply -f base/namespace.yaml
kubectl -n team-hub create secret generic team-hub \
  --from-literal=TEAM_HUB_DB_PASSWORD='your-strong-password'

# 3. Apply base (or pin a release tag via the production overlay).
#    Includes HPA (CPU/memory); requires metrics-server. Tune maxReplicas
#    after pool sizing — see docs/deploy/k8s.md (Autoscaling).
kubectl apply -k base
# kubectl apply -k overlays/production

# 4. Wait for the migrate Job, then confirm pods are Ready
kubectl -n team-hub wait --for=condition=complete job/team-hub-migrate --timeout=300s
kubectl -n team-hub rollout status deployment/team-hub
kubectl -n team-hub get hpa team-hub
```

Validate without applying:

```bash
# Build the rendered manifests (no cluster required)
kubectl kustomize base >/dev/null

# Client-side apply dry-run (needs a reachable API server for OpenAPI)
kubectl apply --dry-run=client -k base
```

## Layout

| Path                       | Purpose                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| `base/`                    | Namespace, ConfigMap, Deployment (2 replicas), HPA, Service, Ingress, migrate Job |
| `base/hpa.yaml`            | CPU/memory HorizontalPodAutoscaler (`minReplicas: 2`, `maxReplicas: 10`)          |
| `base/secret.example.yaml` | Example Secret shape (not included in Kustomize)                                  |
| `overlays/production/`     | Pins `ghcr.io/harborclient/team-hub` image tag                                    |
| `example.env`              | Human worksheet for ConfigMap/Secret values                                       |

## Deploy order

1. Namespace + Secret + ConfigMap
2. Migrate Job (complete successfully)
3. Deployment + Service
4. Ingress (REST + `/notices/stream` SSE annotations)

Serving pods set `TEAM_HUB_SKIP_MIGRATE=true` and `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true`. Run the migrate Job again before each schema-changing upgrade (delete the old Job first if the name still exists).

## Config and secrets

The image entrypoint copies a `server.yaml` template that contains `${TEAM_HUB_*}` placeholders. Pods resolve those placeholders from ConfigMap/Secret env at process load (and on config reload). You can instead mount a ConfigMap `server.yaml` at `/etc/team-hub/server.yaml` with the same placeholders if you need sections the default template leaves commented (`llm`, `storage`, `redis.password`). See [docs/configuration.md](../../docs/configuration.md) (Environment variable interpolation).
