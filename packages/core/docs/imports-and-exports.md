# Imports and exports

Prefer **deep imports** that mirror the module path under `src/`:

```ts
import type { Api } from '@harborclient/core/types';
import { RequestRunner } from '@harborclient/core/requestRunner';
import { CookieJar } from '@harborclient/core/cookies/CookieJar';
```

The package root (`@harborclient/core`) re-exports a curated set of types and helpers (auth, environment variables, collection runner, script refs, and so on). See [`src/index.ts`](https://github.com/harborclient/harborclient/blob/main/packages/core/src/index.ts).

The `#/*` import map in `package.json` is for **internal** package sources only. External consumers should use `@harborclient/core/...`.
