# Server module

Typed HTTP client for [HarborClient Server](https://github.com/harbor/harborclient-server), the companion service that centralizes shared collections, environments, folders, and saved requests for teams. This module runs in the Electron main process. IPC handlers and renderer UI are not wired yet; import from `#/main/server` when integrating server sync.

## Directory layout

| Role           | Files                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Types          | `types.ts` — record and request input types                           |
| Schemas        | `schemas.ts` — Zod schemas for response validation                    |
| Error          | `ServerClientError.ts` — thrown on HTTP and validation failures       |
| Interface      | `IServerClient.ts` — endpoint method contract                         |
| Implementation | `HarborServerClient.ts` — default client with bearer auth and timeout |
| Barrel         | `index.ts` — public exports                                           |
| Tests          | `HarborServerClient.test.ts` — colocated unit tests with mocked fetch |

Import from `#/main/server` for barrel exports, or from specific modules (e.g. `#/main/server/HarborServerClient`) when you need a single class.

## Usage

```typescript
import { HarborServerClient } from '#/main/server';

const client = new HarborServerClient({
  baseUrl: 'http://127.0.0.1:8788',
  token: 'hbk_...'
});

const health = await client.checkHealth();
const collections = await client.listCollections();
```

Protected routes send `Authorization: Bearer hbk_...`. `checkHealth()` is the only public method that omits the token. Failed requests throw `ServerClientError` with `status`, `method`, and `path`.

## API coverage

| Area           | Methods                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Health         | `checkHealth`                                                                                       |
| Collections    | `listCollections`, `createCollection`, `updateCollection`, `deleteCollection`                       |
| Environments   | `listEnvironments`, `createEnvironment`, `updateEnvironment`, `deleteEnvironment`                   |
| Folders        | `listFolders`, `createFolder`, `renameFolder`, `deleteFolder`, `reorderFolders`                     |
| Saved requests | `listRequests`, `createRequest`, `updateRequest`, `deleteRequest`, `reorderRequests`, `moveRequest` |

See HarborClient Server [API Endpoints](https://github.com/harbor/harborclient-server/blob/main/docs/endpoints.md) for request and response shapes.

## Testing

Run the full suite with `pnpm test` (see [`TESTING.md`](../../../TESTING.md)). Unit tests mock `globalThis.fetch` and cover success parsing, `204` handling, auth headers, and error mapping.
