# Usage

```ts
import { Requester, QueryString, HARD_MAX_RESPONSE_SIZE_MB } from '@harborclient/http';

const requester = new Requester();
const result = await requester.executeRequest(
  {
    method: 'GET',
    url: 'https://example.com',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none'
  },
  { requestTimeoutMs: 30000, maxResponseSizeMb: 50, rejectSsl: true, followRedirects: true, proxy: { ... } }
);
```

## Server-Sent Events (SSE)

Open a long-lived event stream with `openSession` instead of `executeRequest`.
Events are delivered through handlers; the body is never buffered as a single
response.

```ts
const session = await requester.openSession(
  {
    protocol: 'sse',
    url: 'https://example.com/events',
    headers: [],
    params: []
  },
  {
    onOpen(info) {
      console.log('connected', info.status, info.statusText);
    },
    onEvent(event) {
      console.log(event.type, event.data);
    },
    onReconnecting(afterMs, attempt) {
      console.log('reconnect', attempt, afterMs);
    },
    onClose(info) {
      console.log('closed', info.reason, info.error);
    }
  },
  { requestTimeoutMs: 30000, rejectSsl: true, followRedirects: true }
);

// Later:
session.close();
```
