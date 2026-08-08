# API Endpoints

Team Hub exposes a JSON HTTP API for shared collections, environments, snippets, folders, saved requests, collection documents, and threaded discussions on requests, collections, folders, and run results. Public routes include `GET /health`, `GET /healthz`, `GET /readyz`, `GET /metrics`, `GET /join`, and the invitation preview/redeem endpoints documented below. All other routes require a valid bearer token — see [Authentication](./auth.md).

## Overview

- **Base URL:** `http://127.0.0.1:8788` (default from `server.yaml`)
- **Content-Type:** `application/json` for request and response bodies
- **Protected routes:** `Authorization: Bearer hbk_...`
- **Tenant (optional):** `X-Harbor-Tenant: <tenant-id>` — omitted requests use the reserved default tenant `__default__`. Non-default tenants require `multitenancy.enabled: true` (see [Configuration — multitenancy](./configuration.md#multitenancy)).

Example authenticated request:

```bash
curl -s http://127.0.0.1:8788/collections \
  -H "Authorization: Bearer hbk_your_token_here"
```

Example with an explicit tenant (advanced):

```bash
curl -s http://127.0.0.1:8788/collections \
  -H "Authorization: Bearer hbk_your_token_here" \
  -H "X-Harbor-Tenant: acme"
```

## Conventions

### Timestamps

Date fields in responses are ISO 8601 strings (for example `"2026-01-01T00:00:00.000Z"`).

### Errors

Failed requests return a JSON body:

```json
{ "error": "Human-readable message" }
```

| Status | When                                                 |
| ------ | ---------------------------------------------------- |
| `400`  | Validation failure or missing required field         |
| `401`  | Missing, malformed, unknown, or revoked bearer token |
| `404`  | Entity not found                                     |

### Empty responses

Routes that return `204 No Content` send a `null` body.

### Shared types

These shapes appear in multiple request and response payloads.

**Variable** — collection or environment variable:

```json
{ "key": "baseUrl", "value": "https://api.example.com", "defaultValue": "", "share": false }
```

**KeyValue** — header or query parameter with enable toggle:

```json
{ "key": "Accept", "value": "application/json", "enabled": true }
```

**AuthConfig** — authorization on collections and saved requests:

```json
{
  "type": "none",
  "basic": { "username": "", "password": "" },
  "bearer": { "token": "" }
}
```

`type` is one of `none`, `basic`, or `bearer`.

**BodyType** — saved request body format: `none`, `json`, `text`, `multipart`, or `urlencoded`.

**HTTP methods** for saved requests: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.

## Health

Team Hub exposes three public probe endpoints. No authentication is required.

| Route | Purpose | Downstream checks |
| ----- | ------- | ----------------- |
| `GET /health` | Legacy shallow check (HarborClient connectivity, older load balancers) | None |
| `GET /healthz` | Liveness — process is up | None |
| `GET /readyz` | Readiness — safe to receive traffic | DB, Redis, and Redis notice pub/sub when enabled |
| `GET /metrics` | Prometheus scrape text | None (refreshes pool/SSE gauges on scrape) |

Orchestrators should use `/healthz` for liveness and `/readyz` for readiness. Keep `/health` for backward compatibility with existing clients and Compose healthchecks. Keep `/metrics` on the pod network (or protect it with `metrics.authToken`); see [Configuration — metrics](./configuration.md#metrics).

### GET /health

Public shallow health check for load balancers and HarborClient connectivity probes. Same payload as `/healthz`; does not verify DB or Redis.

**Response `200`:**

```json
{ "status": "ok", "version": "0.1.0" }
```

```bash
curl -s http://127.0.0.1:8788/health
```

### GET /healthz

Kubernetes-style liveness probe. Returns when the Node process can serve HTTP. Never fails because of database or Redis outages (those belong on `/readyz`).

**Response `200`:**

```json
{ "status": "ok", "version": "0.1.0" }
```

```bash
curl -s http://127.0.0.1:8788/healthz
```

### GET /readyz

Kubernetes-style readiness probe. Returns **200** only when the database and Redis throttle store are reachable. When `redis.noticeEventsPubSub: true`, also verifies notice pub/sub connectivity (required for `GET /notices/stream`). During graceful shutdown, returns **503** immediately so orchestrators stop routing traffic before SSE drain and connection teardown finish.

**Response `200`:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "checks": {
    "db": { "status": "ok" },
    "redis": { "status": "ok" },
    "noticeEvents": { "status": "ok" }
  }
}
```

**Response `503`** when any checked dependency fails (per-dependency detail included):

```json
{
  "status": "error",
  "version": "0.1.0",
  "checks": {
    "db": { "status": "ok" },
    "redis": { "status": "error", "error": "Connection is closed." },
    "noticeEvents": { "status": "ok" }
  }
}
```

```bash
curl -s http://127.0.0.1:8788/readyz
```

### GET /metrics

Prometheus scrape endpoint (text exposition format). Public by default; when `metrics.authToken` is set, require `Authorization: Bearer <token>`. Disabled entirely when `metrics.enabled` is `false`.

```bash
curl -s http://127.0.0.1:8788/metrics | head
```

### GET /join

Public HTML landing page for Team Hub onboarding invitations. No authentication required.

The page renders invitation details from the query string (`url`, `name`, `role`, `exp`, optional `hub`, optional `access`). The one-time invitation secret must appear in the URL fragment (`#code=hbi_...`) so it is not sent to the server or stored in proxy access logs.

HarborClient administrators generate HTTPS invite links from the desktop app. Recipients click the link in a browser, review the invitation details, and launch HarborClient with a `harborclient://team-hub/join?...` deep link.

## Authentication

### GET /auth/session

Returns the authenticated user account, API token metadata, and derived capability flags. Requires a valid bearer token.

Use this route to discover whether a token belongs to a `user` or `admin` account and which API surfaces it may call. HarborClient can probe this endpoint when saving a team hub connection to gate administration UI.

**Response `200`:**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "alice",
    "role": "user",
    "avatarInitials": "AL",
    "avatarColor": "sky-600",
    "avatarImageUrl": "/auth/users/550e8400-e29b-41d4-a716-446655440000/avatar?v=1723118400000"
  },
  "token": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "prefix": "hbk_AbCd1234"
  },
  "capabilities": {
    "dataApi": true,
    "managementApi": false,
    "llm": true,
    "communication": true,
    "discussionE2ee": false
  },
  "tenantId": "__default__",
  "hub": {
    "name": "Default",
    "initials": "DE",
    "color": "violet-600",
    "imageUrl": "/auth/hub/avatar?v=1723118400000"
  }
}
```

`avatarImageUrl` is omitted when the user has not uploaded an image. `hub.imageUrl` is omitted when the hub has no uploaded image. Clients resolve both against the hub base URL and pass the bearer token when fetching bytes.

| Capability       | `user` role                        | `admin` role                         |
| ---------------- | ---------------------------------- | ------------------------------------ |
| `dataApi`        | `true`                             | `true` (implicit full entity access) |
| `managementApi`  | `false`                            | `true`                               |
| `llm`            | `true` when `llmAccess` is enabled | `true` when `llmAccess` is enabled   |
| `communication`  | `true` when `dataApi` is `true`    | `true` when `dataApi` is `true`      |
| `discussionE2ee` | `true` when `collaboration.e2ee` is enabled hub-wide | same |

Discussion routes require `capabilities.communication`. When `discussionE2ee` is `true`, create and update routes reject plaintext bodies — see [Configuration — collaboration](./configuration.md#collaboration).

**Response `401`:** Missing, malformed, unknown, or revoked bearer token.

```bash
curl -s http://127.0.0.1:8788/auth/session \
  -H "Authorization: Bearer hbk_your_token_here"
```

### PUT /auth/profile/avatar

Updates avatar presentation for the authenticated user. Accepts initials, a palette color key, and/or a cropped image data URL. At least one field is required.

**Request body:**

```json
{
  "initials": "ME",
  "color": "rose-600",
  "imageDataUrl": "data:image/jpeg;base64,..."
}
```

Pass `"imageDataUrl": null` to clear a previously uploaded image. Uploaded images must be JPEG, PNG, WebP, or GIF and at most 200 KB after decoding.

**Response `200`:**

```json
{
  "avatarInitials": "ME",
  "avatarColor": "rose-600",
  "avatarImageUrl": "/auth/users/550e8400-e29b-41d4-a716-446655440000/avatar?v=1723118400000"
}
```

**Response `400`:** Invalid body, unsupported MIME type, or image larger than 200 KB.

```bash
curl -s -X PUT http://127.0.0.1:8788/auth/profile/avatar \
  -H "Authorization: Bearer hbk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"imageDataUrl":"data:image/jpeg;base64,..."}'
```

### GET /auth/users/:id/avatar

Serves the uploaded avatar image for a user account. Requires a valid bearer token. The optional `?v=` query is client cache-busting only and is not validated by the server.

**Response `200`:** When the image is stored in the database (`storage.driver: db` or a legacy base64 row), raw image bytes with `Content-Type` set to the stored MIME type, plus `Cache-Control: private, max-age=3600` and an `ETag` derived from the image update timestamp.

**Response `302`:** When the image is stored in external object storage (`storage.driver: s3` or `gcs`), redirects to a short-lived signed URL with `Cache-Control: private, no-cache`. Clients should follow the redirect (HarborClient's `TeamHubClient` does).

**Response `404`:** User not found or no uploaded image.

```bash
curl -sL http://127.0.0.1:8788/auth/users/550e8400-e29b-41d4-a716-446655440000/avatar \
  -H "Authorization: Bearer hbk_your_token_here" \
  -o avatar.jpg
```

### GET /auth/hub/avatar

Serves the uploaded hub avatar image for the active tenant namespace. Requires a valid bearer token. Same `200` / `302` / `404` semantics as [`GET /auth/users/:id/avatar`](#get-authusersidavatar).

```bash
curl -sL http://127.0.0.1:8788/auth/hub/avatar \
  -H "Authorization: Bearer hbk_your_token_here" \
  -o hub-avatar.jpg
```

## Administration

Management routes require an `admin`-role bearer token. `user`-role tokens receive **403 Forbidden**.

### GET /admin/users

Lists user accounts on the Team Hub server. The internal `system` account used for migrations and CLI attribution is omitted.

**Response `200`:**

```json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "alice",
      "role": "user",
      "avatarInitials": "AL",
      "avatarColor": "sky-600",
      "collectionAccess": ["*"],
      "environmentAccess": ["*"],
      "llmAccess": true,
      "llmModels": ["*"],
      "llmMonthlyTokenLimit": 100000,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "warnings": []
    }
  ]
}
```

Each user entry includes a `warnings` array. When stored access lists reference collection, environment, or LLM model ids that no longer exist on the hub, warnings describe the stale references (for example `Unknown collection id "deleted-col".`). An empty array means all referenced ids are valid.

**Response `403`:** Authenticated `user`-role token.

**Response `401`:** Missing, malformed, unknown, or revoked bearer token.

```bash
curl -s http://127.0.0.1:8788/admin/users \
  -H "Authorization: Bearer hbk_your_admin_token_here"
```

### PUT /admin/users/:id

Updates a user account. The internal `system` account cannot be modified (403).

**Request body** (all fields optional):

```json
{
  "name": "alice",
  "role": "user",
  "avatarInitials": "AL",
  "avatarColor": "sky-600",
  "imageDataUrl": "data:image/jpeg;base64,...",
  "collectionAccess": ["*"],
  "environmentAccess": ["*"],
  "llmAccess": true,
  "llmModels": ["*"],
  "llmMonthlyTokenLimit": 100000
}
```

Pass `"imageDataUrl": null` to clear a previously uploaded avatar image. Uploaded images must be JPEG, PNG, WebP, or GIF and at most 200 KB after decoding. When an image is stored, the response includes `avatarImageUrl`.

**Response `200`:** Updated user record (same shape as a user entry in `GET /admin/users`, excluding the `warnings` field).

**Response `400`:** Invalid access list (for example wildcard combined with specific ids), unknown collection/environment/LLM model id in a submitted access list, invalid user name, or invalid avatar image payload. Example:

```json
{ "error": "Unknown collection id: missing-col." }
```

Only access lists explicitly included in the request body are validated against `GET /admin/collections`, `GET /admin/environments`, and `GET /admin/llm/models`. Partial updates that omit access fields leave existing stored access unchanged, even when those stored ids are stale.

**Response `403`:** Authenticated `user`-role token, or attempt to modify the `system` account.

**Response `404`:** Unknown user id.

```bash
curl -s -X PUT http://127.0.0.1:8788/admin/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer hbk_your_admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"alice-renamed"}'
```

### DELETE /admin/users/:id

Deletes a user account and permanently removes all of their API tokens. The internal `system` account cannot be deleted (403).

**Response `204`:** User deleted.

**Response `403`:** Authenticated `user`-role token, or attempt to delete the `system` account.

**Response `404`:** Unknown user id.

```bash
curl -s -X DELETE http://127.0.0.1:8788/admin/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer hbk_your_admin_token_here"
```

### PUT /admin/hub/avatar

Updates hub avatar presentation for the active tenant namespace. Accepts initials, a palette color key, and/or a cropped image data URL. At least one field is required. Admin role only.

**Request body:**

```json
{
  "initials": "HH",
  "color": "amber-600",
  "imageDataUrl": "data:image/jpeg;base64,..."
}
```

Pass `"imageDataUrl": null` to clear a previously uploaded hub image. Uploaded images must be JPEG, PNG, WebP, or GIF and at most 200 KB after decoding.

**Response `200`:**

```json
{
  "name": "Default",
  "initials": "HH",
  "color": "amber-600",
  "imageUrl": "/auth/hub/avatar?v=1723118400000"
}
```

`imageUrl` is omitted when the hub has no uploaded image.

**Response `400`:** Invalid body, unsupported MIME type, or image larger than 200 KB.

**Response `403`:** Authenticated `user`-role token.

```bash
curl -s -X PUT http://127.0.0.1:8788/admin/hub/avatar \
  -H "Authorization: Bearer hbk_your_admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{"imageDataUrl":"data:image/jpeg;base64,..."}'
```

### POST /admin/users

Creates a user account and an initial API bearer token. The plaintext token secret is returned once in the response and is not stored on the server.

**Request body:**

```json
{
  "name": "alice",
  "role": "user",
  "collectionAccess": ["*"],
  "environmentAccess": ["*"],
  "llmAccess": false,
  "llmModels": [],
  "llmMonthlyTokenLimit": null
}
```

**Response `201`:**

```json
{
  "user": { "id": "...", "name": "alice", "role": "user", "...": "..." },
  "token": {
    "id": "...",
    "userId": "...",
    "name": "alice",
    "tokenPrefix": "hbk_AbCd1234",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "lastUsedAt": null,
    "revokedAt": null
  },
  "secret": "hbk_..."
}
```

**Response `400`:** Invalid access lists, duplicate name, or unknown resource ids.

**Response `403`:** Authenticated `user`-role token.

```bash
curl -s -X POST http://127.0.0.1:8788/admin/users \
  -H "Authorization: Bearer hbk_your_admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"alice","role":"user","collectionAccess":["*"],"environmentAccess":["*"]}'
```

### GET /admin/tokens

Lists all API bearer tokens across user accounts (metadata only; never includes secrets).

**Response `200`:**

```json
{
  "tokens": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Desktop",
      "tokenPrefix": "hbk_AbCd1234",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "lastUsedAt": null,
      "revokedAt": null
    }
  ]
}
```

**Response `403`:** Authenticated `user`-role token.

```bash
curl -s http://127.0.0.1:8788/admin/tokens \
  -H "Authorization: Bearer hbk_your_admin_token_here"
```

### POST /admin/users/:id/tokens

Creates an additional API bearer token for an existing user account. The plaintext secret is returned once.

**Request body:**

```json
{ "name": "Desktop" }
```

**Response `201`:**

```json
{
  "token": {
    "id": "...",
    "userId": "...",
    "name": "Desktop",
    "tokenPrefix": "hbk_AbCd1234",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "lastUsedAt": null,
    "revokedAt": null
  },
  "secret": "hbk_..."
}
```

**Response `403`:** Authenticated `user`-role token, or attempt to create a token for the `system` account.

**Response `404`:** Unknown user id.

```bash
curl -s -X POST http://127.0.0.1:8788/admin/users/550e8400-e29b-41d4-a716-446655440000/tokens \
  -H "Authorization: Bearer hbk_your_admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"Desktop"}'
```

### DELETE /admin/tokens/:id

Permanently deletes an API bearer token by id. Tokens owned by the internal `system` account cannot be deleted (403).

**Response `204`:** Token deleted.

**Response `403`:** Authenticated `user`-role token, or attempt to delete a `system` account token.

**Response `404`:** Unknown token id.

```bash
curl -s -X DELETE http://127.0.0.1:8788/admin/tokens/770e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer hbk_your_admin_token_here"
```

### GET /admin/collections

Lists all collections as lightweight `{ id, name, deletionLocked }` records for operator user management.

**Response `200`:**

```json
{
  "collections": [
    { "id": "550e8400-e29b-41d4-a716-446655440000", "name": "Shared API", "deletionLocked": false }
  ]
}
```

**Response `403`:** Authenticated `user`-role token.

```bash
curl -s http://127.0.0.1:8788/admin/collections \
  -H "Authorization: Bearer hbk_your_admin_token_here"
```

### PUT /admin/collections/:id

Updates admin configuration for a collection. Currently supports toggling `deletionLocked` to prevent non-admin users from deleting the collection.

**Request body:**

```json
{ "deletionLocked": true }
```

**Response `200`:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Shared API",
  "deletionLocked": true
}
```

**Response `403`:** Authenticated `user`-role token.

**Response `404`:** Unknown collection id.

### DELETE /admin/collections/:id

Deletes a collection and all nested folders and requests. Admins may delete regardless of `deletionLocked`.

**Response `204`:** Collection deleted.

**Response `403`:** Authenticated `user`-role token.

**Response `404`:** Unknown collection id.

### GET /admin/collections/:collectionId/documents

Lists collection documents in a collection for operator inspection.

**Response `200`:**

```json
{
  "documents": [
    /* document records */
  ]
}
```

**Response `403`:** Authenticated `user`-role token.

**Response `404`:** Unknown collection id.

### GET /admin/environments

Lists all environments as lightweight `{ id, name, deletionLocked }` records for operator user management.

**Response `200`:**

```json
{
  "environments": [
    { "id": "660e8400-e29b-41d4-a716-446655440001", "name": "Production", "deletionLocked": false }
  ]
}
```

**Response `403`:** Authenticated `user`-role token.

```bash
curl -s http://127.0.0.1:8788/admin/environments \
  -H "Authorization: Bearer hbk_your_admin_token_here"
```

### PUT /admin/environments/:id

Updates admin configuration for an environment. Currently supports toggling `deletionLocked` to prevent non-admin users from deleting the environment.

**Request body:**

```json
{ "deletionLocked": true }
```

**Response `200`:**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Production",
  "deletionLocked": true
}
```

**Response `403`:** Authenticated `user`-role token.

**Response `404`:** Unknown environment id.

### DELETE /admin/environments/:id

Deletes an environment. Admins may delete regardless of `deletionLocked`.

**Response `204`:** Environment deleted.

**Response `403`:** Authenticated `user`-role token.

**Response `404`:** Unknown environment id.

### GET /admin/snippets

Lists all snippets as lightweight `{ id, name, deletionLocked }` records for operator user management.

**Response `200`:**

```json
{
  "snippets": [
    { "id": "770e8400-e29b-41d4-a716-446655440001", "name": "Auth helper", "deletionLocked": false }
  ]
}
```

**Response `403`:** Authenticated `user`-role token.

### PUT /admin/snippets/:id

Updates admin configuration for a snippet. Currently supports toggling `deletionLocked`.

**Request body:**

```json
{ "deletionLocked": true }
```

**Response `200`:** Updated snippet admin metadata.

**Response `403`:** Authenticated `user`-role token.

**Response `404`:** Unknown snippet id.

### DELETE /admin/snippets/:id

Deletes a snippet. Admins may delete regardless of `deletionLocked`.

**Response `204`:** Snippet deleted.

**Response `403`:** Authenticated `user`-role token.

**Response `404`:** Unknown snippet id.

### GET /admin/llm/models

Lists all hub-offered LLM models from `server.yaml` for operator user management. Unlike `GET /llm/models`, this route is not filtered by the authenticated admin's own model access list.

**Response `200`:** Same shape as `GET /llm/models`.

**Response `403`:** Authenticated `user`-role token.

**Response `503`:** LLM support is not configured on this Team Hub.

```bash
curl -s http://127.0.0.1:8788/admin/llm/models \
  -H "Authorization: Bearer hbk_your_admin_token_here"
```

### POST /admin/config/reload

Re-reads `server.yaml` and applies reloadable sections (`db`, `redis`, `llm`, `plugins`) without restarting the process. Changes to `server.host` or `server.port` are reported as `restart-required` and are not applied live.

**Auth:** Bearer token required (`admin` role).

**Response `200`:** Reload attempted; see per-section `status` values (`reloaded`, `unchanged`, `failed`, `restart-required`).

**Response `400`:** Config file missing or invalid; nothing was changed. Includes `fatalError`.

**Response `403`:** Authenticated `user`-role token.

```bash
curl -s -X POST http://127.0.0.1:8788/admin/config/reload \
  -H "Authorization: Bearer hbk_your_admin_token_here"
```

Example response:

```json
{
  "sections": [
    { "section": "db", "status": "unchanged" },
    { "section": "redis", "status": "unchanged" },
    { "section": "llm", "status": "reloaded" },
    { "section": "plugins", "status": "reloaded" },
    { "section": "server", "status": "unchanged" }
  ]
}
```

## Collections

Collections are top-level workspaces that hold folders, saved requests, and collection-scoped defaults (variables, headers, scripts, auth).

**Collection record:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Shared API",
  "variables": [],
  "headers": [],
  "auth": {
    "type": "none",
    "basic": { "username": "", "password": "" },
    "bearer": { "token": "" }
  },
  "preRequestScript": "",
  "postRequestScript": "",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### GET /collections

Lists all collections ordered by name. Results are filtered by the authenticated user's collection access list. `admin`-role tokens receive the full catalog (implicit full access) and may also mutate collections and nested folders/requests.

**Auth:** Bearer token required.

**Response `200`:**

```json
{
  "collections": [
    /* collection records */
  ]
}
```

```bash
curl -s http://127.0.0.1:8788/collections \
  -H "Authorization: Bearer hbk_your_token_here"
```

### POST /collections

Creates a new collection with the given display name.

**Auth:** Bearer token required.

**Request body:**

```json
{ "name": "Shared API" }
```

**Response `200`:** Collection record.

**Response `400`:** Validation error (for example empty name).

```bash
curl -s -X POST http://127.0.0.1:8788/collections \
  -H "Authorization: Bearer hbk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"Shared API"}'
```

### PUT /collections/:id

Updates a collection's name, variables, headers, scripts, and auth defaults.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "name": "Shared API",
  "variables": [],
  "headers": [],
  "preRequestScript": "",
  "postRequestScript": "",
  "auth": { "type": "none", "basic": { "username": "", "password": "" }, "bearer": { "token": "" } }
}
```

**Response `200`:** Updated collection record.

**Response `400`:** Validation error.

**Response `404`:** Collection not found.

### DELETE /collections/:id

Deletes a collection and all nested folders and saved requests. Only the user who created the collection may delete it via this route.

**Auth:** Bearer token required.

**Response `204`:** No content.

**Response `403`:** Collection has `deletionLocked: true` (message: `Deletion is locked for this collection.`), or the authenticated user did not create the collection (`{ "error": "Forbidden" }`).

**Response `404`:** Collection not found.

## Environments

Environments hold named variable sets used across requests.

**Environment record:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Production",
  "variables": [],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "deletionLocked": false
}
```

### GET /environments

Lists all environments ordered by name. Results are filtered by the authenticated user's environment access list. `admin`-role tokens receive the full catalog (implicit full access) and may also mutate environments.

**Auth:** Bearer token required.

**Response `200`:**

```json
{
  "environments": [
    /* environment records */
  ]
}
```

```bash
curl -s http://127.0.0.1:8788/environments \
  -H "Authorization: Bearer hbk_your_token_here"
```

### POST /environments

Creates a new environment with the given display name.

**Auth:** Bearer token required.

**Request body:**

```json
{ "name": "Production" }
```

**Response `200`:** Environment record.

**Response `400`:** Validation error.

```bash
curl -s -X POST http://127.0.0.1:8788/environments \
  -H "Authorization: Bearer hbk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"Production"}'
```

### PUT /environments/:id

Updates an environment's name and variables.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "name": "Production",
  "variables": [
    { "key": "baseUrl", "value": "https://api.example.com", "defaultValue": "", "share": false }
  ]
}
```

**Response `200`:** Updated environment record.

**Response `400`:** Validation error.

**Response `404`:** Environment not found.

### DELETE /environments/:id

Deletes an environment by id.

**Auth:** Bearer token required.

**Response `204`:** No content.

**Response `403`:** Environment has `deletionLocked: true` (message: `Deletion is locked for this environment.`).

**Response `404`:** Environment not found.

## Snippets

Snippets hold reusable JavaScript for pre-request and post-request scripts.

**Snippet record:**

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440001",
  "name": "Auth helper",
  "code": "console.log('ok');",
  "scope": "pre-request",
  "sortOrder": 0,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "createdByUserId": "user-id",
  "updatedByUserId": "user-id",
  "deletionLocked": false
}
```

`scope` is one of `pre-request`, `post-request`, or `any`.

### GET /snippets

Lists all snippets ordered by `sortOrder` then name. Results are filtered by the authenticated user's snippet access list. `admin`-role tokens receive the full catalog (implicit full access) and may also mutate snippets.

**Auth:** Bearer token required.

**Response `200`:**

```json
{
  "snippets": [
    /* snippet records */
  ]
}
```

### POST /snippets

Creates a new snippet. Requires wildcard snippet access.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "name": "Auth helper",
  "code": "console.log('ok');",
  "scope": "pre-request"
}
```

**Response `200`:** Snippet record.

**Response `400`:** Validation error.

### PUT /snippets/:id

Updates a snippet's name, code, scope, and sort order.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "name": "Auth helper",
  "code": "console.log('ok');",
  "scope": "any",
  "sortOrder": 1
}
```

**Response `200`:** Updated snippet record.

**Response `400`:** Validation error.

**Response `404`:** Snippet not found.

### DELETE /snippets/:id

Deletes a snippet by id.

**Auth:** Bearer token required.

**Response `204`:** No content.

**Response `403`:** Snippet has `deletionLocked: true` (message: `Deletion is locked for this snippet.`).

**Response `404`:** Snippet not found.

## Live Servers and Live Pages

Team Hub stores Live Server configuration at `/live-servers` and Live Page
(Website) configuration at `/live-pages`. Both resources use UUID string ids.
Configuration fields are accepted as flattened JSON and stored internally in a
JSON payload; responses flatten that payload again alongside server metadata.

### GET /live-servers and GET /live-pages

Lists records visible through `liveServerAccess` or `livePageAccess`.
Administrators receive the full catalog. Responses use `liveServers` and
`livePages` array wrappers respectively.

### POST /live-servers

Requires wildcard live-server access.

```json
{
  "name": "Documentation",
  "root": "/srv/docs",
  "port": 5500,
  "watch": true,
  "openPath": "/index.html"
}
```

All Live Server configuration fields are accepted: `root`, `port`, `aliases`,
`watch`, `cors`, `openPath`, `openPathOnStartup`, `rememberLastUrl`,
`lastOpenedPath`, `indexFiles`, `host`, `headers`, `routes`, `errorPages`,
`proxies`, `ssl`, `runCommand`, `runCommandEnabled`, `restartOnCrash`, `urlVariable`,
`preRequestScripts`, and `postRequestScripts`.

### POST /live-pages

Requires wildcard live-page access.

```json
{
  "name": "Dashboard",
  "url": "https://example.test/app",
  "homeUrl": "https://example.test"
}
```

Live Page payload fields are `url`, `homeUrl`, `faviconDataUrl`, `scripts`,
`preRequestScripts`, `postRequestScripts`, `variables`, `headers`, `userAgent`,
and `auth`.

### PUT /live-servers/:id and PUT /live-pages/:id

Replaces the name and configuration payload. The caller must have access to the
specific record.

### DELETE /live-servers/:id and DELETE /live-pages/:id

Deletes an accessible record unless its `deletionLocked` flag is enabled.

Folders organize saved requests within a collection.

**Folder record:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Users",
  "sortOrder": 0,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### GET /collections/:collectionId/folders

Lists folders in a collection ordered by sort order, then name.

**Auth:** Bearer token required.

**Response `200`:**

```json
{
  "folders": [
    /* folder records */
  ]
}
```

```bash
curl -s http://127.0.0.1:8788/collections/550e8400-e29b-41d4-a716-446655440000/folders \
  -H "Authorization: Bearer hbk_your_token_here"
```

### POST /collections/:collectionId/folders

Creates a folder in the given collection.

**Auth:** Bearer token required.

**Request body:**

```json
{ "name": "Users" }
```

**Response `200`:** Folder record.

**Response `400`:** Validation error.

```bash
curl -s -X POST http://127.0.0.1:8788/collections/550e8400-e29b-41d4-a716-446655440000/folders \
  -H "Authorization: Bearer hbk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"Users"}'
```

### PATCH /folders/:id

Renames a folder by id.

**Auth:** Bearer token required.

**Request body:**

```json
{ "name": "User Management" }
```

**Response `200`:** Updated folder record.

**Response `400`:** Validation error.

**Response `404`:** Folder not found.

### DELETE /folders/:id

Deletes a folder and all saved requests inside it.

**Auth:** Bearer token required.

**Response `204`:** No content.

**Response `404`:** Folder not found.

### PUT /collections/:collectionId/folders/reorder

Reorders folders within a collection.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "orderedFolderIds": [
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003"
  ]
}
```

**Response `204`:** No content.

**Response `404`:** Collection or folder not found.

## Requests

Saved requests store HTTP method, URL, headers, params, body, scripts, and optional folder placement.

**Saved request record:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "List users",
  "method": "GET",
  "url": "https://api.example.com/users",
  "headers": [],
  "params": [],
  "auth": {
    "type": "none",
    "basic": { "username": "", "password": "" },
    "bearer": { "token": "" }
  },
  "body": "",
  "bodyType": "none",
  "preRequestScript": "",
  "postRequestScript": "",
  "comment": "",
  "folderId": null,
  "sortOrder": 0,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

`folderId` is `null` when the request lives at the collection root.

### GET /collections/:collectionId/requests

Lists saved requests in a collection.

**Auth:** Bearer token required.

**Response `200`:**

```json
{
  "requests": [
    /* saved request records */
  ]
}
```

```bash
curl -s http://127.0.0.1:8788/collections/550e8400-e29b-41d4-a716-446655440000/requests \
  -H "Authorization: Bearer hbk_your_token_here"
```

### POST /collections/:collectionId/requests

Creates a new saved request in a collection.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "name": "List users",
  "method": "GET",
  "url": "https://api.example.com/users",
  "headers": [],
  "params": [],
  "auth": {
    "type": "none",
    "basic": { "username": "", "password": "" },
    "bearer": { "token": "" }
  },
  "body": "",
  "bodyType": "none",
  "preRequestScript": "",
  "postRequestScript": "",
  "comment": "",
  "folderId": null
}
```

`folderId` is optional; omit it or set `null` for the collection root.

**Response `200`:** Saved request record.

**Response `400`:** Validation error.

**Response `404`:** Collection or folder not found.

```bash
curl -s -X POST http://127.0.0.1:8788/collections/550e8400-e29b-41d4-a716-446655440000/requests \
  -H "Authorization: Bearer hbk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"List users","method":"GET","url":"https://api.example.com/users","headers":[],"params":[],"auth":{"type":"none","basic":{"username":"","password":""},"bearer":{"token":""}},"body":"","bodyType":"none","preRequestScript":"","postRequestScript":"","comment":""}'
```

### PUT /requests/:id

Updates an existing saved request by id.

**Auth:** Bearer token required.

**Request body:** Same fields as `POST`, plus required `collectionId`:

```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "List users",
  "method": "GET",
  "url": "https://api.example.com/users",
  "headers": [],
  "params": [],
  "auth": {
    "type": "none",
    "basic": { "username": "", "password": "" },
    "bearer": { "token": "" }
  },
  "body": "",
  "bodyType": "none",
  "preRequestScript": "",
  "postRequestScript": "",
  "comment": "",
  "folderId": null
}
```

**Response `200`:** Updated saved request record.

**Response `400`:** Validation error.

**Response `404`:** Request, collection, or folder not found.

### DELETE /requests/:id

Deletes a saved request by id. Only the user who created the request may delete it via this route.

**Auth:** Bearer token required.

**Response `204`:** No content.

**Response `403`:** The authenticated user did not create the request (`{ "error": "Forbidden" }`).

**Response `404`:** Request not found.

### PUT /collections/:collectionId/requests/reorder

Reorders saved requests within a folder or the collection root.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "folderId": null,
  "orderedRequestIds": [
    "550e8400-e29b-41d4-a716-446655440004",
    "550e8400-e29b-41d4-a716-446655440005"
  ]
}
```

Set `folderId` to `null` to reorder requests at the collection root.

**Response `204`:** No content.

**Response `404`:** Collection, folder, or request not found.

### PUT /requests/:id/move

Moves a single saved request to another folder or a specific index at the collection root.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "folderId": "550e8400-e29b-41d4-a716-446655440002",
  "index": 0
}
```

Set `folderId` to `null` to move the request to the collection root at `index`.

**Response `204`:** No content.

**Response `404`:** Request or folder not found.

## Documents

Collection documents store markdown files attached to a collection or folder (for example `README.md`).

**Document record:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "README.md",
  "content": "# API notes",
  "folderId": null,
  "sortOrder": 0,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

`folderId` is `null` when the document lives at the collection root.

### GET /collections/:collectionId/documents

Lists collection documents in a collection.

**Auth:** Bearer token required.

**Response `200`:**

```json
{
  "documents": [
    /* document records */
  ]
}
```

```bash
curl -s http://127.0.0.1:8788/collections/550e8400-e29b-41d4-a716-446655440000/documents \
  -H "Authorization: Bearer hbk_your_token_here"
```

### POST /collections/:collectionId/documents

Creates a new collection document in a collection.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "name": "README.md",
  "content": "# API notes",
  "folderId": null
}
```

**Response `200`:** Created document record.

**Response `400`:** Validation error.

**Response `404`:** Collection or folder not found.

```bash
curl -s -X POST http://127.0.0.1:8788/collections/550e8400-e29b-41d4-a716-446655440000/documents \
  -H "Authorization: Bearer hbk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"README.md","content":"# API notes"}'
```

### PUT /documents/:id

Updates an existing collection document by id.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "README.md",
  "content": "# Updated notes",
  "folderId": null
}
```

**Response `200`:** Updated document record.

**Response `400`:** Validation error.

**Response `404`:** Document, collection, or folder not found.

### DELETE /documents/:id

Deletes a collection document by id. Only the user who created the document may delete it via this route.

**Auth:** Bearer token required.

**Response `204`:** No content.

**Response `403`:** The authenticated user did not create the document (`{ "error": "Forbidden" }`).

**Response `404`:** Document not found.

### PUT /collections/:collectionId/documents/reorder

Reorders collection documents within a folder or the collection root.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "folderId": null,
  "orderedDocumentIds": [
    "550e8400-e29b-41d4-a716-446655440006",
    "550e8400-e29b-41d4-a716-446655440007"
  ]
}
```

Set `folderId` to `null` to reorder documents at the collection root.

**Response `204`:** No content.

**Response `404`:** Collection, folder, or document not found.

### PUT /documents/:id/move

Moves a single collection document to another folder or a specific index at the collection root.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "folderId": "550e8400-e29b-41d4-a716-446655440002",
  "index": 0
}
```

Set `folderId` to `null` to move the document to the collection root at `index`.

**Response `204`:** No content.

**Response `404`:** Document or folder not found.

## Discussions

Threaded comments attached to shared Team Hub entities: saved requests, collections, folders, and run results. Clients should gate on `capabilities.communication` from [`GET /auth/session`](#get-authsession). Access follows the same collection and entity rules as the backing resource.

**Behavior**

- Nesting depth is limited to **3**. Replies deeper than that are flattened to depth 3 rather than rejected.
- Delete is a **soft delete** (tombstone): the comment remains in the tree with `tombstoned: true` and `body: null` so replies stay attached.
- List routes use cursor pagination via optional `cursor` and `limit` (1–100) query parameters.
- New comments, replies, and `@mentions` emit notice kinds `discussion.comment`, `discussion.reply`, and `discussion.mention` for eligible recipients.
- Optional hub-wide E2EE stores ciphertext instead of plaintext bodies — see [Configuration — collaboration](./configuration.md#collaboration).

**Discussion comment** record:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "entityType": "request",
  "entityId": "550e8400-e29b-41d4-a716-446655440004",
  "parentCommentId": null,
  "rootCommentId": "550e8400-e29b-41d4-a716-446655440010",
  "depth": 1,
  "body": "Does this still match the staging contract?",
  "bodyFormat": "plaintext",
  "encryptedPayload": null,
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "alice",
    "avatar": { "initials": "AL", "color": "#3B82F6" }
  },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "tombstoned": false
}
```

`entityType` is one of `request`, `collection`, `folder`, or `runResult`. `bodyFormat` is `plaintext` or `encrypted`. When `bodyFormat` is `encrypted`, `body` is `null` and `encryptedPayload` carries ciphertext metadata for local decryption.

### GET /requests/:id/discussions

Lists discussion comments for a saved request. The same list shape applies to collections, folders, and run results (paths below).

**Auth:** Bearer token required. Caller must be allowed to access the target entity.

**Query:** optional `cursor` (opaque string from a prior response) and `limit` (integer 1–100).

**Response `200`:**

```json
{
  "comments": [
    /* discussion comment records */
  ],
  "nextCursor": "opaque-cursor"
}
```

`nextCursor` is omitted when there are no further pages.

```bash
curl -s 'http://127.0.0.1:8788/requests/550e8400-e29b-41d4-a716-446655440004/discussions?limit=50' \
  -H "Authorization: Bearer hbk_your_token_here"
```

**Response `404`:** Target entity not found.

### POST /requests/:id/discussions

Creates a top-level discussion comment on a saved request.

**Auth:** Bearer token required.

**Request body (plaintext hubs):**

```json
{
  "body": "Does this still match the staging contract?"
}
```

On E2EE hubs, send `encryptedPayload` instead of `body` (see [Configuration — collaboration](./configuration.md#collaboration)).

**Response `200`:** Created discussion comment record.

**Response `400`:** Validation error or plaintext body rejected on an E2EE hub.

**Response `403`:** Caller cannot access the target entity.

**Response `404`:** Target entity not found.

```bash
curl -s -X POST http://127.0.0.1:8788/requests/550e8400-e29b-41d4-a716-446655440004/discussions \
  -H "Authorization: Bearer hbk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"body":"Does this still match the staging contract?"}'
```

### Other entity discussion routes

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/collections/:id/discussions` | List comments on a collection |
| `POST` | `/collections/:id/discussions` | Create a top-level comment on a collection |
| `GET` | `/folders/:id/discussions` | List comments on a folder |
| `POST` | `/folders/:id/discussions` | Create a top-level comment on a folder |
| `GET` | `/run-results/:id/discussions` | List comments on a saved run result |
| `POST` | `/run-results/:id/discussions` | Create a top-level comment on a run result |

Request and response bodies match the request discussion routes above.

### POST /discussion-comments/:id/replies

Creates a reply to an existing discussion comment. Nesting deeper than depth 3 is flattened server-side.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "body": "Yes — staging was updated last week."
}
```

**Response `200`:** Created reply comment record.

**Response `404`:** Parent comment not found.

### PUT /discussion-comments/:id

Updates the body of a discussion comment authored by the authenticated user.

**Auth:** Bearer token required. Only the author may update the body.

**Request body:**

```json
{
  "body": "Updated note after re-checking staging."
}
```

**Response `200`:** Updated discussion comment record.

**Response `403`:** Caller is not the author (or cannot access the target).

**Response `404`:** Comment not found.

### DELETE /discussion-comments/:id

Tombstones a discussion comment. Replies remain in the tree.

**Auth:** Bearer token required. Authors may delete their own comments; admins may delete any comment they can access.

**Response `200`:** Tombstoned discussion comment record (`tombstoned: true`, `body: null`).

**Response `403`:** Caller cannot delete the comment.

**Response `404`:** Comment not found.

### Thread watches

Users can subscribe to a root discussion thread (the root comment id) to receive notices for later replies.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/discussion-threads/:id/subscription` | Return `{ subscribed, rootCommentId }` |
| `POST` | `/discussion-threads/:id/subscribe` | Subscribe the authenticated user |
| `POST` | `/discussion-threads/:id/unsubscribe` | Unsubscribe the authenticated user |

**Auth:** Bearer token required.

**Subscribe response `200`:**

```json
{
  "subscribed": true,
  "rootCommentId": "550e8400-e29b-41d4-a716-446655440010"
}
```

**Response `404`:** Thread not found (subscribe only; `:id` must be a root comment).

### MLS relay (E2EE hubs)

When `collaboration.e2ee` is enabled, clients relay MLS membership material through these routes. Full payload shapes and device enrollment notes live under [Configuration — collaboration](./configuration.md#collaboration).

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/discussion-mls/commits` | Persist an MLS commit for existing members |
| `GET` | `/discussion-mls/commits?mlsGroupId=` | List commits for offline catch-up |
| `POST` | `/discussion-mls/welcomes` | Persist a welcome for a newly added device |
| `GET` | `/discussion-mls/welcomes?mlsGroupId=` | List welcomes for this device/thread |
| `GET` | `/discussion-mls/group-state/:mlsGroupId` | Return the latest observed MLS epoch |

## LLM routes

Hub-proxied LLM routes require bearer authentication and a user account with `llmAccess` enabled. When the `llm` section is absent from `server.yaml`, these routes return `503`.

See [LLM Proxy](./llm.md) for configuration and CLI management.

### `GET /llm/models`

Lists hub-offered models the authenticated user may use.

**Auth:** Bearer token required.

**Response `200`:**

```json
{
  "models": [
    {
      "id": "gpt-4o",
      "label": "GPT-4o",
      "provider": "openai"
    }
  ],
  "capabilities": {
    "openai": true
  }
}
```

`capabilities.openai` is `true` when `llm.providers.openai.apiKey` is configured. HarborClient uses this flag for the **OpenAI** service badge and to enable hub-native documentation search (`search_docs`).

**Response `403`:** User lacks LLM access or the route is forbidden.

**Response `503`:** LLM support is not configured on the hub.

### `GET /llm/usage`

Returns the authenticated user's current monthly token usage.

**Auth:** Bearer token required.

**Response `200`:**

```json
{
  "period": "2026-06",
  "totalTokens": 12345,
  "limit": 100000
}
```

`limit` is `null` when the user has no monthly cap.

### `POST /llm/chat/step`

Runs one stateless LLM completion step using hub-configured provider keys.

**Auth:** Bearer token required.

**Request body:**

```json
{
  "model": "gpt-4o",
  "messages": [{ "role": "user", "content": "Hello" }],
  "systemPrompt": "You are HarborClient assistant.",
  "tools": []
}
```

**Response `200`:**

```json
{
  "content": "Hi there.",
  "toolCalls": [
    {
      "id": "call_1",
      "name": "list_collections",
      "arguments": "{}"
    }
  ],
  "usage": {
    "promptTokens": 10,
    "completionTokens": 5,
    "totalTokens": 15
  }
}
```

**Response `402`:** Monthly token limit reached for a new user turn.

**Response `403`:** User lacks LLM access or the requested model is not allowed.

**Response `503`:** LLM support is not configured on the hub.

## Plugin sources

Team Hubs can declare plugin marketplace catalog and trusted-publisher URLs in `server.yaml` under the optional `plugins` section. HarborClient merges these into **Settings → Plugins** as read-only endpoints for connected users.

Configure in `server.yaml`:

```yaml
plugins:
  catalogs:
    - https://harborclient.com/plugin_catalog.json
  trusted:
    - https://harborclient.com/plugins/trusted.json
```

### `GET /plugins/sources`

Returns plugin catalog and trusted-publisher URLs configured on this Team Hub.

**Auth:** Bearer token required (any authenticated user).

**Response `200`:**

```json
{
  "catalogs": ["https://harborclient.com/plugin_catalog.json"],
  "trusted": ["https://harborclient.com/plugins/trusted.json"]
}
```

When the `plugins` section is omitted from `server.yaml`, both arrays are empty.
