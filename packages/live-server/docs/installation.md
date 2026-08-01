# Installation

```bash
pnpm add @harborclient/live-server
```

In the HarborClient monorepo, depend on the workspace package:

```bash
pnpm --filter @harborclient/live-server... build
```

Peer packages:

- [`@harborclient/core`](https://harborclient.com/core/) — live-server config
  types and normalizers
- [`@harborclient/sdk`](https://harborclient.com/sdk/) — variable substitution
  helpers used by the host
