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
  { requestTimeoutMs: 30000, maxResponseSizeMb: 50, verifySsl: true, followRedirects: true, proxy: { ... } }
);
```
