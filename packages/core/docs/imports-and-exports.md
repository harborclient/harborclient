# Imports and exports

## Module imports

Prefer **deep imports** that mirror the module path under `src/`:

```ts
import type { Api } from '@harborclient/core/types';
import { RequestRunner } from '@harborclient/core/requestRunner';
import { CookieJar } from '@harborclient/core/cookies/CookieJar';
```

The package root (`@harborclient/core`) re-exports a curated set of types and helpers (auth, environment variables, collection runner, script refs, and so on). See [`src/index.ts`](https://github.com/harborclient/harborclient/blob/main/packages/core/src/index.ts).

The `#/*` import map in `package.json` is for **internal** package sources only. External consumers should use `@harborclient/core/...`.

## Portable HarborClient files

`@harborclient/core/filestore` owns Harbor-native portable JSON: parse, validate, and stringify export envelopes. It is the HarborClient equivalent of a native filestore package — **not** a converter for Postman, Bruno, HAR, or other third-party formats. Those converters live in host applications (for example the HarborClient GUI) and should emit `CollectionExport` (or related types) for filestore validation.

### Discriminators

Every portable file includes:

| Field | Role |
| --- | --- |
| `harborclientVersion` | Schema version (`1` today) |
| `harborclientExport` | Kind discriminator |

Supported kinds in filestore today: `collection`, `request`, `environment`, `collection-run-results`, `request-run-results`, and `snippet`. Theme and snippets-bundle helpers live elsewhere (see below). Use `detectExport` (alias of `readHarborclientExport`) to read the discriminator from parsed JSON.

### Parse and stringify

```ts
import {
  detectExport,
  parseCollection,
  stringifyCollection,
  parseRequest,
  stringifyRequest,
  parseEnvironment,
  stringifyEnvironment,
  parseRunResults,
  stringifyRunResults,
  parseSnippet,
  stringifySnippet,
  validateCollectionExport,
  maskVariablesForExport,
  collectionExportContainsScripts
} from '@harborclient/core/filestore';

// From a JSON string or an already-parsed object:
const collection = parseCollection(rawJsonString);
const kind = detectExport(collection); // 'collection'

const json = stringifyCollection(collection, {
  pretty: true,
  maskPrivateVariables: true
});
```

Rules:

- **No filesystem I/O** — callers pass strings or objects; hosts own reading and writing files.
- **`parse*`** — when given a string, runs `JSON.parse`, then validates and normalizes.
- **`stringify*`** — emits canonical envelope JSON. `pretty` defaults to `true`. `maskPrivateVariables` defaults to `false` (hosts that already mask before stringify keep current behavior).
- **`validate*Export`** — same validators used by storage and the GUI; available for callers that already parsed JSON.

### Related helpers

| Kind | Module |
| --- | --- |
| Custom theme (`harborclientExport: "theme"`) | `@harborclient/core/plugin/customThemeExport` |
| Snippets bundle (`harborclientExport: "snippets-bundle"`) | `@harborclient/core/snippetBundle` |
| Building run-results payloads | `@harborclient/core/collectionRunner` (`buildRunResultsExport`) |

Portable TypeScript shapes live under `@harborclient/core/types` (`CollectionExport`, `RequestExport`, `EnvironmentExport`, `SnippetExport`, and so on).
