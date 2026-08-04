# @harborclient/sdk

TypeScript definitions, utility modules, and React runtime helpers for [HarborClient](https://harborclient.com/) development.

**Documentation:** [https://harborclient.github.io/harborclient/sdk/](https://harborclient.github.io/harborclient/sdk/)

Install as a **dev dependency** in your plugin project. The package ships type declarations, HTTP/storage/UI helpers, and a JSX runtime that forwards to the host's React instance (HarborClient installs `hc.react` before `activate(hc)` — no plugin-side setup call is required).

Requires HarborClient **>=1.9.0** when using `hc.pluginId`, renderer HTTP lifecycle events, typed IPC invoke, and host request commands.

## Install

```bash
pnpm add -D @harborclient/sdk
```

See the [install guide](https://harborclient.github.io/harborclient/sdk/install) for version requirements.

## Quick start

```tsx
import type { PluginContext } from '@harborclient/sdk';

export function activate(hc: PluginContext): void {
  // register contributions…
}
```

Full guides — package layout, manifest, APIs, examples, and dev workflow — live in the [plugin development docs](https://harborclient.github.io/harborclient/sdk/).

## Trusted publishers

HarborClient maintains a [trusted publisher registry](https://harborclient.com/plugins/trusted.json). Authors listed there must sign every plugin they publish; HarborClient rejects installs that claim a trusted author name without a valid signature. See the [signing guide](https://harborclient.github.io/harborclient/sdk/signing) for key generation and verification.

To discuss becoming a trusted publisher, email [contact@harborclient.com](mailto:contact@harborclient.com).

## License

MIT
