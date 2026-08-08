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

## Discussions

Gate discussion calls on `session.capabilities.communication` (or `probeCommunicationServiceEnabled()`). Older Team Hub deployments that do not expose discussion routes throw errors you can detect with `isTeamHubCommunicationUnsupportedError`.

```typescript
import { TeamHubClient, isTeamHubCommunicationUnsupportedError } from '@harborclient/team-hub-api';

const client = new TeamHubClient({
  baseUrl: 'http://127.0.0.1:8788',
  token: 'hbk_...'
});

const session = await client.getSession();
if (session.capabilities.communication) {
  const requestId = '550e8400-e29b-41d4-a716-446655440004';
  try {
    const page = await client.listRequestDiscussions(requestId, { limit: 50 });
    await client.createRequestDiscussion(requestId, {
      body: 'Does this still match the staging contract?'
    });
    console.log(page.comments.length);
  } catch (err) {
    if (isTeamHubCommunicationUnsupportedError(err)) {
      // fall back to local notes UI
    } else {
      throw err;
    }
  }
}
```

When `session.capabilities.discussionE2ee` is `true`, send `encryptedPayload` instead of plaintext `body` on create/update/reply. See Team Hub [Configuration — collaboration](https://harborclient.com/team-hub/configuration#collaboration).

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
