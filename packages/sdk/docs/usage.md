# Quick start

Install `@harborclient/sdk` first — see [Install](/install).

## Renderer entry

```tsx
import type { PluginContext } from '@harborclient/sdk';

export function activate(hc: PluginContext): void {
  hc.http.onAfterSend(async (request, response) => {
    // react to completed requests without a main entry
  });
}
```

Do not bundle `react` / `react-dom` in your plugin bundle. For JSX setup, esbuild flags, and hook imports, see [React and JSX](/renderer-overview#react-and-jsx).

## Main entry

Main entries run in the SES utilityProcess for HTTP hooks and custom IPC — not for React UI. Import `MainPluginContext` from `@harborclient/sdk/main`:

```typescript
import type { MainPluginContext } from '@harborclient/sdk/main';

export function activate(hc: MainPluginContext): void {
  hc.http.onBeforeSend((request) => {
    request.headers['X-Trace'] = '1';
  });
}
```

See [Main API](/main-api) for HTTP hooks and IPC, and [Building](/building) to package your plugin as `.hcp`.

## Utility imports

Shared helpers ship as subpath exports (requires `@harborclient/sdk` **0.3.1+**):

```typescript
import { copyToClipboard } from '@harborclient/sdk/clipboard';
import { resolveRequest } from '@harborclient/sdk/http';
import { randomId, truncateBody } from '@harborclient/sdk/runtime-utils';
import {
  asRecord,
  bool,
  createCappedList,
  mergeById,
  num,
  oneOf,
  recordOf,
  str
} from '@harborclient/sdk/storage';
import { createExternalStore } from '@harborclient/sdk/store';
import { formatRelativeTime, methodColorClass } from '@harborclient/sdk/ui';
```

## Plugin build and tooling baseline

Requires `@harborclient/sdk` **0.7.0+**. Shared config reduces drift across plugins.

### Renderer build (`@harborclient/sdk/build`)

Add `scripts/build.mjs`:

```javascript
import { buildRenderer } from '@harborclient/sdk/build';

await buildRenderer({
  jsxRuntime: 'runtime', // 'host' | 'runtime' | 'automatic' | 'none'
  watch: process.argv.includes('--watch')
});
```

Point `package.json` at `node scripts/build.mjs` (and `node scripts/build.mjs --watch` for dev).

Use `jsxRuntime: 'host'` when bundling third-party React libraries (CodeMirror, Font Awesome). Use `nodeBuiltinStubsPlugin(['path', 'fs'])` from the same export when a dependency imports unused Node built-ins (see the dotenv plugin).

### TypeScript (`@harborclient/sdk/tsconfig.base.json`)

```json
{
  "extends": "@harborclient/sdk/tsconfig.base.json",
  "include": ["src"]
}
```

### ESLint (`@harborclient/sdk/eslint`)

`eslint.config.mjs`:

```javascript
export { default } from '@harborclient/sdk/eslint';
```

Your plugin still needs `eslint` as a devDependency; the preset pulls shared rules from the SDK.
