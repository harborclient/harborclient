# Usage

```typescript
import { TeamHubClient } from '@harborclient/team-hub-api';

const client = new TeamHubClient({
  baseUrl: 'http://127.0.0.1:8788',
  token: 'hbk_...'
});

const health = await client.checkHealth();
const session = await client.getSession();
if (session.capabilities.managementApi) {
  // show admin UI; listCollections() and listEnvironments() return full catalogs
}
const collections = await client.listCollections();
const environments = await client.listEnvironments();
```

Protected routes send `Authorization: Bearer hbk_...`. `checkHealth()` is the only method that omits the token; `getSession()` requires a valid bearer token. Failed requests throw `TeamHubClientError` with `status`, `method`, and `path`.

## Multitenancy

When the Team Hub is configured for multitenancy, provide a `tenantId` in the client config:

```typescript
import { TeamHubClient } from '@harborclient/team-hub-api';

const client = new TeamHubClient({
  baseUrl: 'http://127.0.0.1:8788',
  token: 'hbk_...',
  tenantId: 'org-acme'
});
```

The client sends `X-Harbor-Tenant: org-acme` with all requests. When `tenantId` is omitted or empty, the server routes requests to the default tenant. The session response includes a `tenantId` field identifying the active tenant.
