# React

Plugins must share the host React instance. HarborClient installs `hc.react` before `activate(hc)` runs. `@harborclient/sdk` ships a small JSX runtime and hook barrel that forwards to that instance — no plugin-side setup call is required.

**TypeScript** (`tsconfig.json`):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@harborclient/sdk"
  }
}
```

**esbuild** (renderer bundle):

```bash
esbuild src/renderer.tsx \
  --bundle --outfile=dist/renderer.js --format=esm \
  --jsx=automatic --jsx-import-source=@harborclient/sdk \
  --external:react --external:react-dom
```

**Renderer entry:**

```tsx
import type { PluginContext } from '@harborclient/sdk';

export function activate(hc: PluginContext): void {
  // register contributions…
}
```

**Hooks in components** — import from `@harborclient/sdk/react` (not from `react`):

```tsx
import { useEffect, useState } from '@harborclient/sdk/react';
```

**Single-file escape hatch** — `createPluginComponent` builds a component from a factory that receives host React:

```tsx
import { createPluginComponent } from '@harborclient/sdk';
import type { PluginContext } from '@harborclient/sdk';

export function activate(hc: PluginContext): void {
  const Panel = createPluginComponent((React) => {
    return function Panel() {
      const [count, setCount] = React.useState(0);
      return React.createElement('button', { onClick: () => setCount(count + 1) }, count);
    };
  });
}
```

See [harborclient-plugin-skeleton](https://github.com/harborclient/plugin-skeleton) for a complete starter project with renderer and main entries.

<HcMethod name="react" :level="2" />
