# Request logger

This example is a **main-only** plugin that logs every outbound HTTP request to the terminal where HarborClient was launched. It uses `hc.http.onBeforeSend` and `hc.http.onAfterSend` in the SES utilityProcess — no renderer entry, React, or `contributes` block. Useful when you want always-on request tracing without passing `-vv` to the app.

## manifest.json

```json
{
  "id": "com.example.request-logger",
  "name": "Request Logger",
  "version": "1.0.0",
  "engines": { "harborclient": ">=1.7.0" },
  "main": "dist/main.js",
  "permissions": ["http"]
}
```

## src/main.ts

```typescript
import type { MainPluginContext } from '@harborclient/sdk';

export function activate(hc: MainPluginContext): void {
  hc.http.onBeforeSend((request) => {
    console.log(`→ ${request.method} ${request.url}`);
    console.log('  headers:', request.headers);
    if (request.body) {
      console.log('  body:', request.body);
    }
  });

  hc.http.onAfterSend((request, response) => {
    console.log(`← ${response.status} ${response.statusText} (${request.method} ${request.url})`);
  });
}
```

The host exposes `console` inside the utilityProcess sandbox, so `console.log` lines appear in the terminal that started HarborClient (for example the window running `pnpm dev`).

## Packaging

Bundle `src/main.ts` to `dist/main.js`, include `manifest.json`, and pack a `.hcp` file:

```bash
esbuild src/main.ts --bundle --outfile=dist/main.js --format=esm --platform=neutral
```

```
request-logger.hcp        # ZIP archive; use .hcp extension
├── manifest.json
├── README.md
└── dist/
    └── main.js
```

Install the `.hcp` file from **File → Plugins → Install**. Enable the plugin and send a request — log lines appear in your terminal.

HarborClient also supports built-in request logging via `-vv` / `--very-verbose` (see the app README). A plugin logger runs whenever the plugin is enabled and can use any format you choose.

See [Main API](/main-api) for HTTP hook reference and [Building](/building) for packaging steps.
