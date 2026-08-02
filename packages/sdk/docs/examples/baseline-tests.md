# Baseline tests

This example is a **main-only** plugin that injects shared post-request assertions into every send. It uses `hc.http.onBeforeScripts` so house-style checks appear in the Tests tab without editing each collection. Users can opt out for a single send by setting `hc.data.skipBaselineTests = true` in a pre-request script.

## manifest.json

```json
{
  "id": "com.example.baseline-tests",
  "name": "Baseline Tests",
  "version": "1.0.0",
  "engines": { "harborclient": ">=1.7.0" },
  "main": "dist/main.js",
  "permissions": ["scripts:inject"]
}
```

## src/main.ts

```typescript
import type { MainPluginContext, PluginBeforeScriptsContext } from '@harborclient/sdk';

/**
 * Assertions injected ahead of user post-request scripts on every send.
 */
const BASELINE_TESTS = `
hc.test('No server error', () => {
  hc.expect(hc.response.code).to.be.below(500);
});

hc.test('Responded under 2s', () => {
  hc.expect(hc.response.time).to.be.below(2000);
});
`;

/**
 * Adds baseline post-request assertions unless the user opted out per request.
 *
 * @param ctx - Stage context supplying the injection surface.
 */
function injectBaseline(ctx: PluginBeforeScriptsContext): void {
  if (ctx.phase !== 'post') {
    return;
  }
  if (ctx.scripts.data.skipBaselineTests === true) {
    return;
  }

  ctx.scripts.beforeAll.push({ name: 'Baseline checks', script: BASELINE_TESTS });
}

export function activate(hc: MainPluginContext): void {
  hc.http.onBeforeScripts(injectBaseline);
}
```

## Packaging

Bundle `src/main.ts` to `dist/main.js`, include `manifest.json`, and pack a `.hcp` file:

```bash
esbuild src/main.ts --bundle --outfile=dist/main.js --format=esm --platform=neutral
```

```
baseline-tests.hcp
├── manifest.json
├── README.md
└── dist/
    └── main.js
```

Install the `.hcp` file from **File → Plugins → Install**. Enable the plugin and send a request — baseline rows appear in the Tests tab before request-specific assertions.

See [Main API — hc.http.onBeforeScripts](/main-api#hchttponbeforescriptshandler) for the hook reference.
