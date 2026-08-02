# Trace correlation

This example seeds a trace id into the shared `hc.data` bag, injects a pre-request script that stamps it onto the outgoing request, and persists the status code against that id after the send. A post-stage hook also reads back values user scripts may have written into the bag.

Requires both `scripts:inject` (injection + data bag) and `http` / `storage` (after-send persistence).

## manifest.json

```json
{
  "id": "com.example.trace-correlation",
  "name": "Trace Correlation",
  "version": "1.0.0",
  "engines": { "harborclient": ">=1.7.0" },
  "main": "dist/main.js",
  "permissions": ["scripts:inject", "http", "storage"]
}
```

## src/main.ts

```typescript
import type { MainPluginContext } from '@harborclient/sdk';

export function activate(hc: MainPluginContext): void {
  /**
   * Seeds a trace id into the shared script bag and injects a script that
   * stamps it onto the outgoing request.
   */
  hc.http.onBeforeScripts((ctx) => {
    if (ctx.phase === 'pre') {
      ctx.scripts.data.traceId = crypto.randomUUID();

      ctx.scripts.beforeAll.push({
        name: 'Stamp trace id',
        script: `
          hc.request.headers.set('X-Trace-Id', hc.data.traceId);
          console.log('trace', hc.data.traceId);
        `
      });
      return;
    }

    // Post stage: user scripts may have recorded findings in the bag.
    if (typeof ctx.scripts.data.retryReason === 'string') {
      ctx.scripts.afterAll.push({
        name: 'Report retry reason',
        script: `console.warn('retry requested:', hc.data.retryReason);`
      });
    }
  });

  /**
   * Correlates the wire request with the trace id and persists the mapping.
   */
  hc.http.onAfterSend(async (request, response) => {
    const traceId = request.headers['X-Trace-Id'];
    if (!traceId) {
      return;
    }

    const seen = (await hc.storage.get<Record<string, number>>('traces')) ?? {};
    seen[traceId] = response.status;
    await hc.storage.set('traces', seen);
  });
}
```

## Packaging

```bash
esbuild src/main.ts --bundle --outfile=dist/main.js --format=esm --platform=neutral
```

```
trace-correlation.hcp
├── manifest.json
├── README.md
└── dist/
    └── main.js
```

Install from **File → Plugins → Install**. On each send, the injected script stamps `X-Trace-Id`; the after-send hook stores `status` under that id in plugin storage. A user post-request script can set `hc.data.retryReason` and the next post-stage injection will log it.

See [Main API — hc.http.onBeforeScripts](/main-api#hchttponbeforescriptshandler) and [hc.http.onAfterSend](/main-api#hchttponaftersendhandler).
