# Server

**Requires the `server` permission.**

Runs a local HTTP echo server in the Electron main process (express). Port `0` selects the first available non-privileged port from the OS. Register `onRequest` before calling `start` so incoming traffic is routed through your handler.

```typescript
import type { MainPluginContext } from '@harborclient/sdk';
import { createHttpResponse } from '@harborclient/sdk/runtime-utils';

export function activate(hc: MainPluginContext): void {
  hc.server.onRequest(async (request) => {
    // Legacy: return custom JSON (always HTTP 200), or undefined for the default echo payload.
    if (request.path === '/echo') {
      return { ...request.echo, custom: true };
    }

    // Structured: custom status, headers, body, and delay.
    return createHttpResponse({
      status: 404,
      headers: { 'X-Mock': '1' },
      body: { error: 'not found', path: request.path },
      delayMs: 0
    });
  });
  void hc.server.start({ port: 0 }).then(({ port }) => {
    console.log(`Echo server listening on http://localhost:${port}`);
  });
}
```

<HcMethod name="server.onRequest" :level="2" />

<HcMethod name="server.start" :level="2" />

<HcMethod name="server.stop" :level="2" />
