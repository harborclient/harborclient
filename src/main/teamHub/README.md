# Team Hub module

Typed HTTP client for [HarborClient Server](https://github.com/harbor/harborclient-server), the companion service that centralizes shared collections, environments, folders, and saved requests for teams. This module runs in the Electron main process. IPC handlers and renderer UI are not wired yet; import from `#/main/teamHub` when integrating team hub sync.

## Directory layout

| Role           | Files                                                            |
| -------------- | ---------------------------------------------------------------- |
| Types          | `types.ts` — record and request input types                      |
| Schemas        | `schemas.ts` — Zod schemas for response validation               |
| Error          | `TeamHubClientError.ts` — thrown on HTTP and validation failures |
| Interface      | `ITeamHubClient.ts` — endpoint method contract                   |
| Implementation | `TeamHubClient.ts` — default client with bearer auth and timeout |
| Barrel         | `index.ts` — public exports                                      |
| Tests          | `TeamHubClient.test.ts` — colocated unit tests with mocked fetch |

Import from `#/main/teamHub` for barrel exports, or from specific modules (e.g. `#/main/teamHub/TeamHubClient`) when you need a single class.

## Usage

```typescript
import { TeamHubClient } from '#/main/teamHub';

const client = new TeamHubClient({
  baseUrl: 'http://127.0.0.1:8788',
  token: 'hbk_...'
});

const health = await client.checkHealth();
const session = await client.getSession();
if (session.capabilities.managementApi) {
  // show admin UI
}
const collections = await client.listCollections();
```

Protected routes send `Authorization: Bearer hbk_...`. `checkHealth()` is the only method that omits the token; `getSession()` requires a valid bearer token. Failed requests throw `TeamHubClientError` with `status`, `method`, and `path`.

## API coverage

| Area           | Methods                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Health / auth  | `checkHealth`, `getSession`                                                                         |
| Collections    | `listCollections`, `createCollection`, `updateCollection`, `deleteCollection`                       |
| Environments   | `listEnvironments`, `createEnvironment`, `updateEnvironment`, `deleteEnvironment`                   |
| Folders        | `listFolders`, `createFolder`, `renameFolder`, `deleteFolder`, `reorderFolders`                     |
| Saved requests | `listRequests`, `createRequest`, `updateRequest`, `deleteRequest`, `reorderRequests`, `moveRequest` |

See HarborClient Server [API Endpoints](https://github.com/harbor/harborclient-server/blob/main/docs/endpoints.md) for request and response shapes.

## Testing

Run the full suite with `pnpm test` (see [`TESTING.md`](../../../TESTING.md)). Unit tests mock `globalThis.fetch` and cover success parsing, `204` handling, auth headers, and error mapping.
