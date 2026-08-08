# Configuration

Team Hub reads a YAML file named `server.yaml` (by default in the current working directory). Override the path with `-c` / `--config` on any CLI subcommand. See [CLI — Global options](./cli.md#global-options).

Copy the example file to get started:

```bash
cp server.yaml.example server.yaml
```

The canonical example at the repository root is [`server.yaml.example`](https://github.com/harborclient/harborclient/blob/main/packages/team-hub/server.yaml.example).

## Environment variable interpolation

String scalars in `server.yaml` may reference process environment variables. Placeholders are resolved when the config is loaded and again on every live reload (`SIGHUP` or `POST /admin/config/reload`). YAML structure remains the source of truth — interpolation does not invent keys that are absent from the file.

| Pattern | Behavior |
| ------- | -------- |
| `${NAME}` | Substitute `NAME` from the environment. Fails fast with `ConfigError` if unset or empty. |
| `${NAME:-default}` | Use the env value when set and non-empty; otherwise use `default` (may be empty). |
| `$${NAME}` | Escape hatch — becomes a literal `${NAME}` in the resolved value. |

Only **string** YAML values are interpolated. Numbers and booleans written as YAML literals are unchanged. After substitution, string forms such as `"true"` / `"false"` / `"8787"` are still accepted by the usual Zod coercions (ports, optional booleans from Docker templates, and so on).

```yaml
db:
  driver: postgres
  host: ${TEAM_HUB_DB_HOST:-127.0.0.1}
  port: ${TEAM_HUB_DB_PORT:-5432}
  user: ${TEAM_HUB_DB_USER}
  password: ${TEAM_HUB_DB_PASSWORD}
  database: ${TEAM_HUB_DB_DATABASE}

redis:
  host: ${TEAM_HUB_REDIS_HOST}
  port: ${TEAM_HUB_REDIS_PORT}
  password: ${TEAM_HUB_REDIS_PASSWORD:-}

llm:
  providers:
    openai:
      apiKey: ${TEAM_HUB_LLM_OPENAI_API_KEY}
```

Wire secrets through the platform (Compose `env_file`, Kubernetes Secrets as env, Cloud Run `--set-secrets`) and keep placeholders in the mounted or generated YAML so passwords are not written to disk. See [Docker environment variables](#docker-environment-variables) and the deploy guides for Cloud Run / Kubernetes.

## Sections overview

| Section         | Required | Live reload | Notes                                                 |
| --------------- | -------- | ----------- | ----------------------------------------------------- |
| `server`        | Yes      | No          | Changes to `host` or `port` require a process restart |
| `db`            | Yes      | Yes         | Reconnects when the raw `db` mapping changes          |
| `redis`         | Yes      | Yes         | Reconnects when the raw `redis` mapping changes       |
| `logging`       | No       | No          | Applied at process startup; restart after changes     |
| `metrics`       | No       | No          | Prometheus scrape endpoint; restart after changes     |
| `storage`       | No       | Yes         | Avatar blob storage (`db` default, or `s3` / `gcs`)   |
| `llm`           | No       | Yes         | Omit to disable hub-proxied LLM routes                |
| `plugins`       | No       | Yes         | Omit to return empty plugin source lists              |
| `docs`          | No       | Yes         | Optional path to the documentation search index       |
| `multitenancy`  | No       | No          | Applied at process startup; restart after changes     |
| `collaboration` | No       | Yes         | Discussion E2EE mode; reload via SIGHUP or admin reload |

Reload triggers while `team-hub start` is running:

- `SIGHUP` to the start process
- `POST /admin/config/reload` (admin bearer token required)

See [Docker Compose — Using the CLI in the container](/deploy/docker#using-the-cli-in-the-container) for details and response shape.

## server

HTTP listen settings for the Team Hub API.

| Key    | Type                      | Required | Default | Description                                |
| ------ | ------------------------- | -------- | ------- | ------------------------------------------ |
| `port` | integer or numeric string | Yes      | —       | TCP port (1–65535)                         |
| `host` | string                    | Yes      | —       | Bind address (e.g. `127.0.0.1`, `0.0.0.0`) |

```yaml
server:
  port: 8787
  host: 127.0.0.1
```

## db

Database backend. Set `driver` to `postgres`, `mysql`, or `firestore`. Driver-specific fields are validated when the server connects.

### Postgres

| Key                       | Type                      | Required | Default         | Description                                                                 |
| ------------------------- | ------------------------- | -------- | --------------- | --------------------------------------------------------------------------- |
| `driver`                  | `postgres`                | Yes      | —               | Database driver                                                             |
| `host`                    | string                    | Yes      | —               | Single database endpoint (host or Unix socket). Use a pooler or writer proxy — see [Read replicas and connection pooling](#read-replicas-and-connection-pooling). |
| `port`                    | integer or numeric string | Yes      | —               | Database port (1–65535)                                                     |
| `user`                    | string                    | Yes      | —               | Database user                                                               |
| `password`                | string                    | Yes      | —               | Database password (may be empty)                                            |
| `database`                | string                    | Yes      | —               | Database name                                                               |
| `max`                     | integer or numeric string | No       | driver default  | Maximum clients in the pool (`pg` `max`, typically 10 when omitted)         |
| `idleTimeoutMillis`       | integer or numeric string | No       | driver default  | Idle client timeout in milliseconds                                         |
| `connectionTimeoutMillis` | integer or numeric string | No       | driver default  | New-client connect timeout in milliseconds                                  |
| `ssl`                     | boolean or object         | No       | driver default  | TLS toggle (`true`/`false`) or `{ rejectUnauthorized, ca, cert, key }`      |

```yaml
db:
  driver: postgres
  host: 127.0.0.1
  port: 5432
  user: harbor
  password: harbor
  database: harbor
  # Optional pool tuning for multi-instance deployments:
  # max: 10
  # idleTimeoutMillis: 10000
  # connectionTimeoutMillis: 2000
  # ssl: true
```

### MySQL

Same connection and pool fields as Postgres; use `driver: mysql` and the appropriate port (typically `3306`). `host` is a single endpoint (pooler or writer) — see [Read replicas and connection pooling](#read-replicas-and-connection-pooling). Pool field mapping:

| Config key                  | mysql2 option       |
| --------------------------- | ------------------- |
| `max`                       | `connectionLimit`   |
| `idleTimeoutMillis`         | `idleTimeout`       |
| `connectionTimeoutMillis`   | `connectTimeout`    |
| `ssl: true`                 | `ssl: {}`           |
| `ssl: { … }`                | passed through      |

```yaml
db:
  driver: mysql
  host: 127.0.0.1
  port: 3306
  user: harbor
  password: harbor
  database: harbor
  # max: 10
  # ssl: true
```

### Pool sizing

When running multiple Team Hub replicas against one database, size each process pool so total connections stay under the server limit:

```text
replicas × db.max ≤ max_connections × 0.75
```

Leave headroom (~25%) for admin sessions, migrations, and monitoring. Example: Cloud SQL with `max_connections = 100` and 3 replicas → set `db.max` to at most `25` (`3 × 25 = 75 ≤ 75`). Omitting `max` keeps the driver default (typically 10 per process).

### Read replicas and connection pooling

Team Hub opens **one** SQL connection pool per process, bound to a single `db.host` (or `TEAM_HUB_DB_HOST`). There is no `db.readHost`, no query classifier, and no driver-level read/write split. Every query — reads, writes, migrations, and readiness `SELECT 1` — goes to that endpoint.

This section applies to **Postgres and MySQL** only. Firestore has no app-configurable replica endpoint; use GCP’s managed Firestore scaling instead.

#### Recommended: pool through a proxy

For multi-instance deploys, point `db.host` at a **connection pooler** or managed **writer** endpoint rather than opening many long-lived connections straight to Postgres/MySQL:

| Approach | Role |
| -------- | ---- |
| [PgBouncer](https://www.pgbouncer.org/) | Multiplex app pools onto fewer backend connections |
| [Amazon RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html) | Managed pooling in front of RDS / Aurora |
| Aurora / RDS **cluster writer** endpoint | Single write-capable hostname for the app |
| Cloud SQL primary / Auth Proxy | See [Google Cloud Run](/deploy/gcp#cloud-sql-postgres) |

Primary benefit: many Team Hub pods can share a smaller set of backend connections. Keep using the [pool sizing](#pool-sizing) formula for the **client** side (`replicas × db.max`); size the proxy and database `max_connections` separately (below).

#### PgBouncer

Prefer **transaction pooling** for connection efficiency. Team Hub uses explicit `BEGIN` / `COMMIT` in a few flows (for example tenant delete, invitation redeem, and invited-user create); those work with transaction pooling.

Session-level Postgres features (`LISTEN` / `NOTIFY`, session advisory locks, unnamed prepared statements that span transactions) are incompatible with transaction pooling. Team Hub does not rely on those today. Still run **migrations and admin DDL against the primary** — either bypass the pooler for the migrate Job, or use a separate PgBouncer database/user in **session** mode for migrate only. See [Docker Compose — Multi-instance migrations](/deploy/docker#multi-instance-migrations-and-notice-fan-out) and [Kubernetes](/deploy/k8s).

#### AWS RDS Proxy / Aurora

Set `db.host` to the **cluster writer endpoint** or an RDS Proxy target group that targets the writer. Enable TLS with `db.ssl` / `TEAM_HUB_DB_SSL` when the proxy or instance requires it.

Do **not** point Team Hub at a **read-only** Aurora endpoint (or a reader-only Proxy target) unless you fully accept the consistency risks in [Read splitting without app support](#read-splitting-without-app-support).

#### Google Cloud SQL

Production Cloud Run and Kubernetes deploys should use the **primary** instance connection name or IP (Unix socket `/cloudsql/PROJECT:REGION:INSTANCE` on Cloud Run). Cloud SQL read replicas are fine for analytics backups and reporting tools; Team Hub itself should not target them.

At high `max-instances` or pod counts, place [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy) or PgBouncer in front of the primary to multiplex connections — Team Hub still uses one `TEAM_HUB_DB_HOST`. See [Google Cloud Run](/deploy/gcp#cloud-sql-postgres) and [Configuration — Pool sizing](#pool-sizing).

#### MySQL (RDS Proxy, ProxySQL)

The same single-host rule applies: `db.max` maps to mysql2 `connectionLimit`. Point `db.host` at RDS Proxy (writer) or a ProxySQL listener that sends **all** traffic to the primary. Enabling ProxySQL (or similar) read/write split has the same consistency warnings as Postgres read splitting below.

#### Read splitting without app support

**Not recommended.** Proxies that route `SELECT`s to replicas while sending writes to the primary can break Team Hub under replication lag:

- **Bearer auth** — every protected request looks up the token hash; a token created on the primary may 401 on a lagging replica.
- **Invitation redeem** — multi-statement transactions followed by immediate reads.
- **Collection / request / document saves** — write then list or reload.
- **Notices** — persist then unread counts / SSE fan-out.

Symptoms include intermittent **401**s, stale lists, and missing rows after create/update. Prefer a writer-only (or transaction-pooling) proxy until an app-level `db.readHost` path exists.

#### When read scaling still helps

- Offload **reporting and analytics** to a read replica with **direct SQL** (not through Team Hub).
- Scale vertically (larger primary) and/or add a connection pooler before introducing read replicas for the app.
- A future product change could add `db.readHost` and route truly read-only queries; that is **not** implemented today.

#### Sizing with a proxy

Budget three layers:

```text
app clients:     maxReplicas × db.max          →  connections into the proxy
proxy backends:  pooler default_pool_size × … →  connections into Postgres/MySQL
database:        max_connections              →  leave ~25% headroom
```

Example: 10 pods × `db.max=10` ⇒ **100** client connections into PgBouncer or RDS Proxy. With transaction pooling, backend connections to Postgres are often far fewer than 100 — size `default_pool_size` / RDS Proxy max connections from measured concurrency, not 1:1 with client pools. The database `max_connections` budget must still cover proxy backends, the migrate Job, and admin sessions.

#### Migrate Job

Always run `team-hub migrate` against the **primary** (direct host or writer pool), never a read replica. Use the same pattern as multi-replica deploys: migrate once as a Job, then serve with `TEAM_HUB_SKIP_MIGRATE=true` — see [Kubernetes](/deploy/k8s) and [Google Cloud Run](/deploy/gcp#migrations-via-cloud-run-job).

### Firestore

| Key           | Type        | Required | Description                             |
| ------------- | ----------- | -------- | --------------------------------------- |
| `driver`      | `firestore` | Yes      | Database driver                         |
| `projectId`   | string      | Yes      | GCP project id                          |
| `keyFilename` | string      | No       | Path to a service account JSON key file |

```yaml
db:
  driver: firestore
  projectId: my-gcp-project
  keyFilename: /path/to/service-account.json
```

When `keyFilename` is omitted, Firestore uses Application Default Credentials (workload identity, `GOOGLE_APPLICATION_CREDENTIALS`, etc.).

## redis

Redis is required for authentication throttling. Protected routes return **503** when Redis is unreachable. See [Authentication](./auth.md).

| Key                  | Type                             | Required | Default | Description                                                              |
| -------------------- | -------------------------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `host`               | string                           | Yes      | —       | Redis host                                                               |
| `port`               | integer or numeric string        | Yes      | —       | Redis port (1–65535)                                                     |
| `password`           | string                           | No       | —       | Redis AUTH password                                                      |
| `db`                 | integer (0–15) or numeric string | No       | `0`     | Redis logical database index                                             |
| `keyPrefix`          | string                           | No       | —       | Prefix for throttle keys                                                 |
| `maxFailures`        | integer or numeric string        | No       | `10`    | Failed auth attempts before block                                        |
| `windowSeconds`      | integer or numeric string        | No       | `900`   | Sliding window for failure counting                                      |
| `blockSeconds`       | integer or numeric string        | No       | `900`   | Block duration after threshold                                           |
| `noticeEventsPubSub` | boolean                          | No       | `false` | When true, fan out notice SSE events over Redis pub/sub (multi-instance) |

```yaml
redis:
  host: 127.0.0.1
  port: 6380
  password: redis-secret
  keyPrefix: team-hub:
  maxFailures: 10
  windowSeconds: 900
  blockSeconds: 900
  # Set true when multiple Team Hub app instances share Redis for notice SSE fan-out:
  # noticeEventsPubSub: true
```

When `noticeEventsPubSub` is `true`, each app process opens a Redis publisher and subscriber in addition to the throttle client. Any replica can serve `GET /notices/stream`; the stream returns **503** if Redis pub/sub is unavailable. Leave the flag unset (or `false`) for single-instance deployments that use in-process fan-out.

## logging

Optional request and error logging via [Winston](https://github.com/winstonjs/winston). Applied when the process starts; restart `team-hub start` after changes.

| Key       | Type                                | Required | Default | Description                                                          |
| --------- | ----------------------------------- | -------- | ------- | -------------------------------------------------------------------- |
| `level`   | `debug`, `info`, `warn`, or `error` | No       | `info`  | Minimum severity written to transports                               |
| `file`    | string                              | No       | —       | Log file path; omit to disable file output                           |
| `console` | boolean                             | No       | `true`  | When true, also write logs to the terminal                           |
| `format`  | `json` or `simple`                  | No       | `json`  | Wire format (`json` for Loki/Cloud Logging; `simple` for local terminals) |

Every HTTP request is logged at **debug** level on ingress (method, URL, IP, request id). Completions are logged as `request completed` with `statusCode` and `durationMs` — at **info** when `format: json`, and at **debug** when `format: simple`. Unhandled request errors are logged at **error** level.

```yaml
logging:
  level: info
  file: /var/log/team-hub.log
  console: true
  format: json
```

## metrics

Optional Prometheus scrape endpoint. Applied when the process starts; restart `team-hub start` after changes. Defaults enable `GET /metrics` without authentication.

| Key         | Type    | Required | Default    | Description                                                                 |
| ----------- | ------- | -------- | ---------- | --------------------------------------------------------------------------- |
| `enabled`   | boolean | No       | `true`     | When false, skips `/metrics` and HTTP request instrumentation               |
| `path`      | string  | No       | `/metrics` | Scrape path                                                                 |
| `authToken` | string  | No       | —          | When set, scrapers must send `Authorization: Bearer <token>`                |

Keep `/metrics` off public Ingress. Prefer pod-network scrapes (annotations / ServiceMonitor) or set `authToken` and treat it as a secret.

Core series:

| Metric | Type | Notes |
| ------ | ---- | ----- |
| `team_hub_http_requests_total` | counter | Labels: `method`, `route`, `status_code` (probes/`/metrics` excluded) |
| `team_hub_http_request_duration_seconds` | histogram | Labels: `method`, `route` |
| `team_hub_sse_connections` | gauge | Open notice SSE connections on this process |
| `team_hub_db_pool_connections` | gauge | Labels: `state`=`total\|idle\|waiting`, `backend` |
| `team_hub_db_pool_max` | gauge | Configured pool max |
| `team_hub_auth_throttled_total` | counter | Labels: `scope`=`bearer\|invitation` |
| `team_hub_notice_events_published_total` | counter | Labels: `type` |

Process default metrics from [prom-client](https://github.com/siimon/prom-client) (CPU, memory, event loop) are also registered.

```yaml
metrics:
  enabled: true
  path: /metrics
  # authToken: scrape-secret
```

### Alert ideas

- `team_hub_db_pool_connections{state="waiting"} > 0` sustained → pool exhaustion; raise `db.max` or add replicas carefully
- `rate(team_hub_auth_throttled_total[5m])` spike → brute-force or misconfigured client
- `team_hub_sse_connections` imbalance across pods → sticky sessions or uneven load
- `histogram_quantile(0.99, sum(rate(team_hub_http_request_duration_seconds_bucket[5m])) by (le, route))` elevated on protected routes
- Intermittent **401**s or stale lists after deploy, especially with a new DB endpoint → confirm `db.host` / `TEAM_HUB_DB_HOST` is the **writer** or a pooler without read-split; replication lag on a read-only or split-read proxy breaks read-after-write (see [Read replicas and connection pooling](#read-replicas-and-connection-pooling))

## storage

Optional avatar blob storage. When omitted, Team Hub keeps the default `driver: db` behavior (base64 images in Postgres/MySQL/Firestore). Reloadable via SIGHUP or `POST /admin/config/reload`.

| Key | Type | Required | Default | Description |
| --- | ---- | -------- | ------- | ----------- |
| `driver` | `db` \| `s3` \| `gcs` | No | `db` | Where uploaded avatar bytes are stored |
| `prefix` | string | No | `avatars` | Object key prefix inside the bucket |
| `signedUrlTtlSeconds` | number | No | `900` | Lifetime of signed read URLs used by avatar GET redirects |
| `bucket` | string | Yes for `s3`/`gcs` | — | Target bucket |
| `region` | string | Yes for `s3` | — | AWS region (or compatible) |
| `endpoint` | string | No | — | Custom S3-compatible endpoint (MinIO, etc.) |
| `accessKeyId` / `secretAccessKey` | string | Yes for `s3` | — | S3 credentials |
| `projectId` | string | No | — | GCS project (often from ADC) |
| `keyFilename` | string | No | — | Path to a GCS service-account JSON key |

With `s3` or `gcs`:

- Uploads store an object key in `avatar_image_key` and clear the base64 column.
- `GET /auth/users/:id/avatar` and `GET /auth/hub/avatar` authenticate the caller, then **302** to a short-lived signed URL (`Cache-Control: private, no-cache`).
- JSON `imageUrl` / `avatarImageUrl` values remain relative Team Hub paths with `?v={updatedAtMs}` for client cache busting — never the signed URL.
- Legacy rows that still have base64 in `avatar_image` continue to stream bytes from the API until migrated.

Migrate existing DB blobs after switching drivers:

```bash
team-hub -c /etc/team-hub/server.yaml migrate-avatars
team-hub -c /etc/team-hub/server.yaml migrate-avatars --dry-run
team-hub -c /etc/team-hub/server.yaml migrate-avatars --tenant-id acme
```

IAM needs `PutObject` / `DeleteObject` / `GetObject` (S3) or equivalent GCS objectAdmin/objectViewer for the service account. On GKE/Cloud Run prefer Workload Identity + ADC instead of `keyFilename`.

```yaml
storage:
  driver: s3
  bucket: team-hub-avatars
  region: us-east-1
  accessKeyId: ...
  secretAccessKey: ...
  prefix: avatars
  signedUrlTtlSeconds: 900
```

## llm

Optional hub-proxied LLM access. Omit this section to disable LLM routes. At least one provider `apiKey` is required when the section is present. User access and monthly token limits are configured via the CLI — see [LLM](./llm.md).

| Key                       | Type         | Required | Description                                                                        |
| ------------------------- | ------------ | -------- | ---------------------------------------------------------------------------------- |
| `providers.openai.apiKey` | string       | No\*     | OpenAI API key                                                                     |
| `providers.claude.apiKey` | string       | No\*     | Anthropic API key                                                                  |
| `providers.gemini.apiKey` | string       | No\*     | Google Gemini API key                                                              |
| `models`                  | string array | No       | Allow-list of model ids; omit to offer all catalog models whose provider has a key |
| `mcp`                     | array        | No       | Hub MCP servers the agent may call during chat steps (see below)                   |

\* At least one provider entry with a non-empty `apiKey` is required.

### llm.mcp

Optional MCP servers Team Hub connects to during `POST /llm/chat/step`. Tools from these servers are merged into the provider request and executed on the hub; HarborClient never sees hub MCP tool names or results directly.

| Key       | Type            | Required | Description                             |
| --------- | --------------- | -------- | --------------------------------------- |
| `name`    | string          | Yes      | Display name for logs                   |
| `url`     | string          | Yes      | MCP server URL (Streamable HTTP or SSE) |
| `headers` | object or array | No       | HTTP headers sent with MCP requests     |

`headers` accepts any of these shapes (they normalize to key/value pairs):

- Object map: `{ "x-api-key": "..." }`
- Array of single-key objects: `[{ "x-api-key": "..." }]`
- One nested array level: `- [ { "x-api-key": "..." } ]`

```yaml
llm:
  providers:
    openai:
      apiKey: sk-...
  models:
    - gpt-4o
  mcp:
    - name: Exa
      url: https://mcp.exa.ai/mcp
      headers:
        - [{ 'x-api-key': 'your-exa-key' }]
```

Supported model ids when using the default catalog:

| Provider | Model ids                                                 |
| -------- | --------------------------------------------------------- |
| `openai` | `gpt-4o`, `gpt-4o-mini`                                   |
| `claude` | `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022` |
| `gemini` | `gemini-1.5-pro`, `gemini-1.5-flash`                      |

```yaml
llm:
  providers:
    openai:
      apiKey: sk-...
    claude:
      apiKey: sk-ant-...
  models:
    - gpt-4o
    - claude-3-5-sonnet-20241022
```

## plugins

Optional plugin source URLs for HarborClient. Omit this section to return empty lists. Authenticated HarborClient instances merge these read-only endpoints into Settings → Plugins.

| Key        | Type      | Required | Description                   |
| ---------- | --------- | -------- | ----------------------------- |
| `catalogs` | URL array | No       | Plugin catalog JSON URLs      |
| `trusted`  | URL array | No       | Trusted plugin list JSON URLs |

Each entry must be a valid HTTP or HTTPS URL.

```yaml
plugins:
  catalogs:
    - https://harborclient.com/plugin_catalog.json
  trusted:
    - https://harborclient.com/plugins/trusted.json
```

## docs

Optional documentation vector search settings for hub-native `search_docs`. Omit this section to use the Docker default path `/app/data/docsSearchIndex.json` and other built-in fallbacks.

| Key               | Type   | Required | Description                                              |
| ----------------- | ------ | -------- | -------------------------------------------------------- |
| `searchIndexPath` | string | No       | Path to serialized `docsSearchIndex.json` (Orama export) |

Rebuild the index in the harborclient repository with `pnpm index-docs`. The Docker image fetches the latest published index at build time; see [Docker Compose — Documentation index](/deploy/docker#documentation-index).

```yaml
docs:
  searchIndexPath: /app/data/docsSearchIndex.json
```

Hub-native docs search also requires `llm.providers.openai.apiKey`. Without OpenAI or a readable index file, `search_docs` is removed from hub chat tool lists.

## multitenancy

Optional tenant isolation. Omit this section (or leave `enabled: false`) for a normal single-tenant install. Every request then uses the reserved default tenant `__default__`, and clients do not need a tenant header.

| Key       | Type    | Required | Default | Description                                                                 |
| --------- | ------- | -------- | ------- | --------------------------------------------------------------------------- |
| `enabled` | boolean | No       | `false` | When true, non-default tenants may be selected via `X-Harbor-Tenant`        |

When `enabled` is `false`, only the default tenant is accepted. A non-default `X-Harbor-Tenant` header returns **400**. When `enabled` is `true`, clients may send `X-Harbor-Tenant: <tenant-id>` to select another tenant created with the CLI (`team-hub tenant create`). Missing headers still resolve to `__default__`.

`__default__` is reserved: it is created automatically on migrate and cannot be created, renamed, or deleted by operators.

```yaml
multitenancy:
  enabled: false
```

Restart `team-hub start` after changing `multitenancy.enabled`. Tenant records are managed with the CLI — see [CLI](./cli.md).

## collaboration

Optional discussion encryption mode for Team Hub. Plaintext discussions work without this section — see [API Endpoints — Discussions](./endpoints.md#discussions) for list/create/reply/delete and thread-watch routes. Omit this section (or leave `e2ee: false`) for normal plaintext discussion bodies.

| Key    | Type    | Required | Default | Description                                                                 |
| ------ | ------- | -------- | ------- | --------------------------------------------------------------------------- |
| `e2ee` | boolean | No       | `false` | When true, discussion create/update routes reject plaintext bodies hub-wide |

When `e2ee` is `true`:

- `GET /auth/session` reports `capabilities.discussionE2ee: true`
- Discussion create/update routes accept `encryptedPayload` objects instead of plaintext `body`
- Discussion list responses expose `bodyFormat: "encrypted"`, `encryptedPayload` metadata, and `body: null`
- Collaboration notices omit comment preview snippets
- HarborClient encrypts comment bodies locally before upload and decrypts list responses when this device is enrolled

Encrypted discussion write bodies use this shape:

```json
{
  "encryptedPayload": {
    "ciphertext": "base64-bytes",
    "mlsGroupId": "thread:request:<request-id>",
    "epoch": 0,
    "senderDeviceId": "<device-uuid>",
    "keyFormat": "identity-v1"
  }
}
```

The server stores ciphertext in the comment `body` column plus metadata (`mlsGroupId`, `epoch`, `senderDeviceId`, optional commit references) and never decrypts it. HarborClient uses the `mls-v1` membership protocol with persisted MLS commits and welcomes for offline catch-up. The older `identity-v1` format remains readable for legacy encrypted comments created before Task 4.5.

MLS relay routes (E2EE hubs only):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/discussion-mls/commits` | Persist an MLS commit for existing members |
| `GET` | `/discussion-mls/commits?mlsGroupId=` | List commits for offline catch-up |
| `POST` | `/discussion-mls/welcomes` | Persist a welcome for a newly added device |
| `GET` | `/discussion-mls/welcomes?mlsGroupId=` | List welcomes for this device/thread |
| `GET` | `/discussion-mls/group-state/:mlsGroupId` | Return the latest observed MLS epoch |

When `e2ee` is enabled, users enroll devices through `POST /devices` with public key material only. HarborClient stores private keys locally in encrypted settings and never uploads them. Admins revoke compromised devices with `DELETE /admin/device-keys/:id`. Revocation and lost private keys can make older encrypted content unrecoverable unless another authorized device can re-add the user in a later MLS release.

```yaml
collaboration:
  e2ee: false
```

## Docker environment variables

On first boot (when `/etc/team-hub/server.yaml` is missing or empty), the Docker entrypoint **copies** the image template into place. The on-disk file keeps `${TEAM_HUB_*}` placeholders; the Node process resolves them from the container environment at load and on each config reload. Secrets such as `TEAM_HUB_DB_PASSWORD` are therefore not baked into the YAML file. Restarts preserve an existing file; set `TEAM_HUB_FORCE_CONFIG_GENERATE=true` once to replace a stale copy from the template. Mount a host `server.yaml` (with or without placeholders) to survive container recreation. The CLI does not read `TEAM_HUB_CONFIG`; pass `-c /etc/team-hub/server.yaml` explicitly.

| Variable                   | Default                          | Maps to           |
| -------------------------- | -------------------------------- | ----------------- |
| `TEAM_HUB_HOST`            | `127.0.0.1`                      | `server.host`     |
| `TEAM_HUB_PORT`            | `8787`                           | `server.port`     |
| `TEAM_HUB_DB_DRIVER`       | `postgres`                       | `db.driver`       |
| `TEAM_HUB_DB_HOST`         | `127.0.0.1`                      | `db.host`         |
| `TEAM_HUB_DB_PORT`         | `5432`                           | `db.port`         |
| `TEAM_HUB_DB_USER`         | `harbor`                         | `db.user`         |
| `TEAM_HUB_DB_PASSWORD`     | `harbor`                         | `db.password`     |
| `TEAM_HUB_DB_DATABASE`     | `harbor`                         | `db.database`     |
| `TEAM_HUB_DB_MAX`          | _(empty)_                        | `db.max`          |
| `TEAM_HUB_DB_IDLE_TIMEOUT_MILLIS` | _(empty)_                 | `db.idleTimeoutMillis` |
| `TEAM_HUB_DB_CONNECTION_TIMEOUT_MILLIS` | _(empty)_           | `db.connectionTimeoutMillis` |
| `TEAM_HUB_DB_SSL`          | _(empty)_                        | `db.ssl` (`true` / `false`) |
| `TEAM_HUB_REDIS_HOST`      | `127.0.0.1`                      | `redis.host`      |
| `TEAM_HUB_REDIS_PORT`      | `6379`                           | `redis.port`      |
| `TEAM_HUB_REDIS_NOTICE_EVENTS_PUBSUB` | `false`                 | `redis.noticeEventsPubSub` |
| `TEAM_HUB_LOGGING_LEVEL`   | `info`                           | `logging.level`   |
| `TEAM_HUB_LOGGING_FILE`    | `/var/log/team-hub/team-hub.log` | `logging.file`    |
| `TEAM_HUB_LOGGING_CONSOLE` | `true`                           | `logging.console` |
| `TEAM_HUB_LOGGING_FORMAT`  | `json`                           | `logging.format`  |
| `TEAM_HUB_METRICS_ENABLED` | `true`                           | `metrics.enabled` |
| `TEAM_HUB_METRICS_PATH`    | `/metrics`                       | `metrics.path`    |
| `TEAM_HUB_METRICS_AUTH_TOKEN` | _(empty)_                     | `metrics.authToken` |
| `TEAM_HUB_MULTITENANCY_ENABLED` | `false`                     | `multitenancy.enabled` |

Empty optional DB pool env vars (`TEAM_HUB_DB_MAX`, timeouts, `TEAM_HUB_DB_SSL`) resolve via `${VAR:-}` defaults and keep driver defaults. Object-form `ssl` (CA/cert/key) is not expressible via env — mount a custom `server.yaml` instead. Optional `llm` / `plugins` / `storage` / `redis.password` are commented in the image template; mount a YAML that references `${TEAM_HUB_LLM_*}` (or similar) and inject those secrets as env vars. Logging and metrics apply at process startup — restart the container after changing those env vars. Changing secret env vars for reloadable sections (`db`, `redis`, `llm`, …) can be picked up with `SIGHUP` / admin reload without regenerating the on-disk file. See [Deploy](/deploy/).

## Related docs

- [Setup](./setup.md) — install, migrate, and start the server
- [Deploy](/deploy/) — Docker image, hosting guides, config reload, and env var reference
- [Authentication](./auth.md) — bearer tokens and Redis throttling
- [LLM](./llm.md) — user access and usage limits
