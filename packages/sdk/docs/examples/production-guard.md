# Production guard

This example blocks sends to production hosts by injecting a pre-request `before-all` script that calls `hc.execution.skipRequest()`. Injection is more powerful than `onBeforeSend` here, because only script context can skip the HTTP send and leave a clear console message.

Blocked host fragments are read from plugin storage. This walkthrough seeds a default list when nothing is stored yet; a follow-on can add a renderer settings contribution that writes `{ "blockedHosts": ["…"] }` under the `guard` key via `hc.storage`.

## manifest.json

```json
{
  "id": "com.example.production-guard",
  "name": "Production Guard",
  "version": "1.0.0",
  "engines": { "harborclient": ">=2.0.0" },
  "main": "dist/main.js",
  "permissions": ["scripts:inject", "storage"]
}
```

## src/main.ts

```typescript
import type { MainPluginContext } from '@harborclient/sdk';

/**
 * Config persisted by the plugin (optionally from a later settings contribution).
 */
interface GuardConfig {
  /**
   * Hostname fragments treated as production.
   */
  blockedHosts: string[];
}

export function activate(hc: MainPluginContext): void {
  hc.http.onBeforeScripts(async (ctx) => {
    if (ctx.phase !== 'pre') {
      return;
    }

    const config = await hc.storage.get<GuardConfig>('guard');
    const blocked = config?.blockedHosts ?? ['api.prod.example.com'];
    if (!blocked.some((fragment) => ctx.request.url.includes(fragment))) {
      return;
    }

    ctx.scripts.beforeAll.push({
      name: 'Production guard',
      script: `
        console.error('Blocked by production guard: ' + hc.request.url);
        hc.execution.skipRequest();
      `
    });
  });
}
```

## Packaging

```bash
esbuild src/main.ts --bundle --outfile=dist/main.js --format=esm --platform=neutral
```

```
production-guard.hcp
├── manifest.json
├── README.md
└── dist/
    └── main.js
```

Install from **File → Plugins → Install**. Sends whose URL contains a blocked fragment skip HTTP and show the guard message in the console. Customize the list by storing `{ "blockedHosts": ["…"] }` under the `guard` key with `hc.storage`.

See [hc.http.onBeforeScripts](/api/http#hchttponbeforescriptshandler).
