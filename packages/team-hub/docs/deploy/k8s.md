# Kubernetes

Deploy Team Hub on Kubernetes when you want **multiple replicas** behind an Ingress, with **external Postgres and Redis**. Manifests live under [`packages/team-hub/deploy/k8s/`](https://github.com/harborclient/harborclient/tree/main/packages/team-hub/deploy/k8s) (Kustomize base + optional production overlay).

> [!WARNING]
> Do **not** enable bundled Postgres or Redis in Kubernetes. Pod storage is ephemeral and each replica would get its own database. Set `TEAM_HUB_START_POSTGRES=false` and `TEAM_HUB_START_REDIS=false` (already set in the example ConfigMap).

Pull the prebuilt image from GHCR — see [Deploy overview](/deploy/) for tags.

## Prerequisites

- A Kubernetes cluster (1.25+ recommended)
- [`kubectl`](https://kubernetes.io/docs/tasks/tools/) and optionally [`kustomize`](https://kubectl.docs.kubernetes.io/installation/kustomize/)
- [nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/) (or another ingress with SSE-friendly buffering/timeouts)
- Reachable **Postgres** and **Redis** (managed or in-cluster)
- Ability to pull `ghcr.io/harborclient/team-hub` (public package, or imagePullSecrets if private)

## Architecture

| Component | Role |
| --------- | ---- |
| Deployment (`replicas: 2`) | App pods (Nginx on 8080 → Fastify); skip migrate on start |
| HPA `team-hub` | Scales Deployment on CPU/memory (`minReplicas: 2`, `maxReplicas: 10`) |
| Job `team-hub-migrate` | Runs `migrate` once before traffic |
| Service ClusterIP | Port 80 → container 8080 |
| Ingress (REST) | Host routing for API paths |
| Ingress (notices) | `/notices/stream` with buffering off and long timeouts |
| ConfigMap + Secret | Non-secret env + `TEAM_HUB_DB_PASSWORD` |

Multi-replica requirements (already wired in the example ConfigMap):

| Variable | Value | Why |
| -------- | ----- | --- |
| `TEAM_HUB_START_POSTGRES` | `false` | External DB |
| `TEAM_HUB_START_REDIS` | `false` | Shared Redis |
| `TEAM_HUB_SKIP_MIGRATE` | `true` | Avoid DDL races; migrate via Job |
| `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB` | `true` | Notice SSE fan-out across pods |

Without `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true`, each pod only broadcasts notices in-memory and clients on other pods miss events.

Optional avatar object storage (`storage.driver: s3` or `gcs`) keeps large avatar blobs out of Postgres. Mount a ConfigMap/Secret snippet for the `storage` section (or a full `server.yaml`), grant the pod IAM/`Secret` credentials for the bucket, then run `team-hub migrate-avatars` once after enabling. See [Configuration — storage](/configuration#storage).

```text
Ingress ──► Service ──► Pod (Nginx :8080) ──► Fastify :8787
                              │
                    external Postgres + Redis
```

## Configure

1. Copy [`example.env`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/k8s/example.env) as a worksheet (not loaded by kubectl).
2. Edit [`base/configmap.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/k8s/base/configmap.yaml): set `TEAM_HUB_DB_*` / `TEAM_HUB_REDIS_*` hosts, `TEAM_HUB_DB_MAX`, and `TEAM_HUB_DB_SSL` for your environment.
3. Edit Ingress hosts in `base/ingress.yaml` and `base/ingress-notices.yaml` (`team-hub.example.com` → your hostname). Add TLS if your cluster uses cert-manager or a TLS secret.
4. Optionally pin the image tag in [`overlays/production/kustomization.yaml`](https://raw.githubusercontent.com/harborclient/harborclient/main/packages/team-hub/deploy/k8s/overlays/production/kustomization.yaml).

### Secret

Create the Secret before applying the rest of the stack (preferred over applying `secret.example.yaml`). The Deployment injects Secret keys as environment variables; the image template keeps `password: ${TEAM_HUB_DB_PASSWORD}` on disk and Node resolves it at load/reload (secrets are not written into the YAML file).

```bash
kubectl apply -f packages/team-hub/deploy/k8s/base/namespace.yaml

kubectl -n team-hub create secret generic team-hub \
  --from-literal=TEAM_HUB_DB_PASSWORD='your-strong-password'
```

Optionally mount a custom `server.yaml` ConfigMap at `/etc/team-hub/server.yaml` that uses the same `${TEAM_HUB_*}` placeholders for LLM keys, Redis AUTH, or object storage — see [Configuration — Environment variable interpolation](/configuration#environment-variable-interpolation).

### Pool sizing

Size each pod’s pool so total connections stay under the database limit. With HPA enabled, use **`maxReplicas`** (not the current replica count) in the budget:

```text
maxReplicas × TEAM_HUB_DB_MAX ≤ max_connections × 0.75
```

Example: `max_connections = 100`, fixed `replicas = 2` → `TEAM_HUB_DB_MAX` at most `37` (leave headroom for the migrate Job and admin sessions). With the example HPA (`maxReplicas: 10`) and `TEAM_HUB_DB_MAX=10`, peak demand is `100` connections — raise Postgres limits or lower `maxReplicas` / pool size. See [Autoscaling](#autoscaling) and [Configuration — Pool sizing](/configuration#pool-sizing).

Set ConfigMap `TEAM_HUB_DB_HOST` to the **writer** hostname or a pooler Service DNS (PgBouncer, RDS Proxy), not a read-only replica Service. Team Hub uses one SQL endpoint with no app-level read routing; when a pooler sits in front of Postgres, budget proxy backend connections and database `max_connections` separately. See [Configuration — Read replicas and connection pooling](/configuration#read-replicas-and-connection-pooling).

## Deploy order

From a clone of this repository (or after downloading the `deploy/k8s` tree):

```bash
cd packages/team-hub/deploy/k8s

# Validate
kubectl apply --dry-run=client -k base

# Apply (after Secret + ConfigMap edits)
kubectl apply -k base
# Or pin a release:
# kubectl apply -k overlays/production

# Migrate must succeed before serving traffic
kubectl -n team-hub wait --for=condition=complete job/team-hub-migrate --timeout=300s

kubectl -n team-hub rollout status deployment/team-hub
```

Order of operations:

1. Namespace  
2. Secret  
3. ConfigMap (via `kubectl apply -k`)  
4. Migrate Job — wait until `Complete`  
5. Deployment + Service  
6. Ingress  

The Kustomize base applies Job and Deployment together; pods stay unready until `/readyz` passes (DB + Redis). Prefer waiting on the Job before sending user traffic through Ingress.

### Bypass Nginx (optional)

The default Service targets container port **8080** (bundled Nginx), which already disables buffering for `/notices/stream`. Advanced operators can expose Fastify on **8787** instead by changing the Service `targetPort` and probes — not required for this example.

## Verify

```bash
# Port-forward if Ingress is not yet reachable
kubectl -n team-hub port-forward svc/team-hub 8080:80

curl -s http://127.0.0.1:8080/healthz
curl -s http://127.0.0.1:8080/readyz
```

- `/healthz` — liveness (process up; no DB/Redis check)  
- `/readyz` — readiness (DB + Redis; notice pub/sub when enabled)

Smoke-test notice SSE (authenticated client or HarborClient desktop). Long-lived streams need the notices Ingress annotations (below).

## Ingress and notice SSE

Bundled Nginx sets `proxy_buffering off` and long read timeouts for `GET /notices/stream`. The example splits Ingress resources so the same settings apply at the cluster edge:

| Ingress | Path | Annotations |
| ------- | ---- | ----------- |
| `team-hub` | `/` | Default REST |
| `team-hub-notices` | `/notices/stream` | `proxy-buffering: off`, `proxy-read-timeout` / `proxy-send-timeout`: `3600` |

Annotations target the **nginx** Ingress Controller. Traefik, AWS ALB, or Gateway API need equivalent SSE settings. See [Docker Compose — Notice SSE disconnects](/deploy/docker#notice-sse-get-noticesstream-disconnects-behind-a-reverse-proxy). HarborClient desktop clients fall back to REST polling when the stream is unavailable.

## Graceful shutdown

Pods use `terminationGracePeriodSeconds: 30`. Team Hub force-exits after `TEAM_HUB_SHUTDOWN_TIMEOUT_MS` (default **25s**), which must stay **below** the grace period. Use **60** for the grace period if hub LLM/MCP steps are often long-running. See [Docker Compose — Graceful shutdown](/deploy/docker#graceful-shutdown).

## Upgrades

1. Update the image tag (`overlays/production` or `base/kustomization.yaml` `images.newTag`).
2. Re-run migrations when the release includes schema changes:
   ```bash
   kubectl -n team-hub delete job team-hub-migrate --ignore-not-found
   kubectl apply -k base   # or overlays/production
   kubectl -n team-hub wait --for=condition=complete job/team-hub-migrate --timeout=300s
   ```
3. Confirm the Deployment rolls out: `kubectl -n team-hub rollout status deployment/team-hub`.

Serving pods keep `TEAM_HUB_SKIP_MIGRATE=true` so rolling updates never race on DDL.

## Observability

Pods expose Prometheus metrics at `GET /metrics` (Nginx port 8080 → Fastify). Do **not** add `/metrics` to Ingress — scrape from the pod network only.

### Annotation-based scrape (Prometheus Operator / kube-prometheus)

Add these annotations on the Deployment pod template (or Service):

```yaml
metadata:
  annotations:
    prometheus.io/scrape: 'true'
    prometheus.io/path: /metrics
    prometheus.io/port: '8080'
```

### Optional ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: team-hub
  namespace: team-hub
spec:
  selector:
    matchLabels:
      app: team-hub
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

Set `TEAM_HUB_LOGGING_FORMAT=json` (default in the image) so pod logs are machine-parseable for Loki / Cloud Logging. See [Configuration — metrics](/configuration#metrics) for series names and alert ideas. Optional scrape auth: set `TEAM_HUB_METRICS_AUTH_TOKEN` in the Secret and configure the scraper Bearer token to match.

## Autoscaling

The Kustomize base includes a [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/) (`base/hpa.yaml`) that scales Deployment `team-hub` on **CPU** and **memory** utilization.

| Setting | Value | Notes |
| ------- | ----- | ----- |
| API | `autoscaling/v2` | K8s 1.25+ |
| `minReplicas` | `2` | Matches the Deployment default; keep ≥2 for multi-instance notices |
| `maxReplicas` | `10` | **Tune from DB pool math** (below), not cluster size alone |
| CPU target | 65% of `requests.cpu` | Primary signal (`requests.cpu: 1` in the example) |
| Memory target | 80% of `requests.memory` | Secondary; HPA uses the **max** desired replicas across metrics |
| Scale-down | 300s stabilization, 1 pod / 60s | Avoids thrashing while SSE connections drain |
| Scale-up | Up to 2 pods / 60s | Responds quickly under load |

The Deployment keeps `replicas: 2` as a fallback when HPA is not installed. When the HPA is present, it owns the replica count at runtime.

### Prerequisites

Resource-based HPA needs [metrics-server](https://github.com/kubernetes-sigs/metrics-server) (or an equivalent Metrics API). Without it, the HPA stays in `FailedGetResourceMetric` and replicas do not change.

```bash
kubectl get apiservice v1beta1.metrics.k8s.io \
  -o jsonpath='{.status.conditions[?(@.type=="Available")].status}'
# Expect: True
```

Confirm pod metrics: `kubectl -n team-hub top pods`.

### Apply and verify

HPA is applied with the rest of the base (or production overlay):

```bash
kubectl apply --dry-run=client -k base
kubectl apply -k base   # or overlays/production

kubectl -n team-hub get hpa team-hub
kubectl -n team-hub describe hpa team-hub   # TARGETS, Conditions
```

### Capacity planning

HPA does **not** replace database connection budgeting. Set `maxReplicas` so peak scale still fits Postgres (and Redis):

```text
max_connections_budget = max_connections × 0.75
required_for_hpa_max   = maxReplicas × TEAM_HUB_DB_MAX
                         + headroom (migrate Job, admin sessions, other apps)
```

Worked example with the ConfigMap default `TEAM_HUB_DB_MAX=10` and `maxReplicas: 10`:

```text
max_connections = 100 → budget ≈ 75
maxReplicas × TEAM_HUB_DB_MAX = 10 × 10 = 100  (exceeds budget)

Fix one of:
  - lower maxReplicas to 7 (7 × 10 = 70 ≤ 75)
  - raise Postgres max_connections
  - lower TEAM_HUB_DB_MAX (e.g. 7 → 10 × 7 = 70)
```

Also plan for:

- **Redis** — each pod uses a throttle client plus notice pub/sub (publisher + subscriber when `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB=true`). Size Redis `maxclients` / Memorystore tier for `maxReplicas`.
- **Ingress / SSE** — more pods spread notice streams; the notices Ingress already disables buffering. Uneven `team_hub_sse_connections` across pods may mean sticky sessions or unbalanced load — see [Configuration — alert ideas](/configuration#alert-ideas).
- **Pool waiting** — alert on sustained `team_hub_db_pool_connections{state="waiting"} > 0` before raising `maxReplicas` further.

### Optional: custom metrics

The shipped HPA uses only metrics-server CPU/memory. To scale on Team Hub Prometheus series (for example average `team_hub_sse_connections` per pod, or p99 latency from `team_hub_http_request_duration_seconds`), install [prometheus-adapter](https://github.com/kubernetes-sigs/prometheus-adapter) and scrape `/metrics` (annotations or ServiceMonitor above). Adapter install is **out of scope** for this example.

Example adapter rule (illustrative — tune for your adapter ConfigMap):

```yaml
rules:
  - seriesQuery: 'team_hub_sse_connections{namespace!="",pod!=""}'
    resources:
      overrides:
        namespace: { resource: 'namespace' }
        pod: { resource: 'pod' }
    name:
      matches: '^team_hub_sse_connections$'
      as: 'sse_connections'
    metricsQuery: 'sum(<<.Series>>{<<.LabelMatchers>>}) by (<<.GroupBy>>)'
```

Example HPA metric (add alongside or instead of resource metrics; not in the Kustomize base):

```yaml
metrics:
  - type: Pods
    pods:
      metric:
        name: sse_connections
      target:
        type: AverageValue
        averageValue: '50'
```

### When not to use HPA

- Single-node [VPS](/deploy/vps) or Compose with fixed capacity
- Postgres or Redis cannot support the connection budget at `maxReplicas`
- You prefer a fixed replica count — omit `hpa.yaml` from Kustomize or delete the HPA after apply

## Troubleshooting

### `GET /readyz` returns 503

Readiness fails when Postgres, Redis, or (when enabled) notice pub/sub is unreachable. Check the `checks` object in the JSON body and pod logs:

```bash
kubectl -n team-hub logs deploy/team-hub -c team-hub --tail=100
```

Confirm ConfigMap hosts and that NetworkPolicies allow egress to Postgres/Redis.

### Migrate Job fails

```bash
kubectl -n team-hub logs job/team-hub-migrate -c copy-config
kubectl -n team-hub logs job/team-hub-migrate -c wait-deps
kubectl -n team-hub logs job/team-hub-migrate -c migrate
```

Common causes: wrong DB password, TLS required (`TEAM_HUB_DB_SSL=true`), or database not reachable from the cluster. After fixing ConfigMap/Secret, delete the Job and re-apply.

### Notice SSE disconnects

Confirm the `team-hub-notices` Ingress is applied and that your ingress controller honors long timeouts and disabled buffering. See [Docker Compose SSE notes](/deploy/docker#notice-sse-get-noticesstream-disconnects-behind-a-reverse-proxy).

### Pods not Ready after migrate

Cold start can take 30–60s while the entrypoint copies config and starts Nginx + Node. Check events: `kubectl -n team-hub describe pod -l app=team-hub`.

## Related guides

- [Deploy overview](/deploy/) — image tags and bundled vs managed services
- [Docker Compose — External Postgres and Redis](/deploy/docker#external-postgres-and-redis) — Compose equivalent of this stack
- [Google Cloud Run](/deploy/gcp) — managed serverless with Cloud SQL / Memorystore
- [VPS](/deploy/vps) — single-node path before graduating to multi-instance
- [Configuration](/configuration) — env interpolation, Docker env mapping, and pool sizing
