# Installation

Requires **Node.js 22+**.

## In the HarborClient monorepo

The package is a workspace member. From the repository root:

```bash
pnpm install
pnpm --filter @harborclient/core build
```

Consumers inside the monorepo import it as `@harborclient/core` or `@harborclient/core/<path>` (see [Imports and exports](/imports-and-exports)).

## As a published package

Published builds resolve from `dist/` (see `publishConfig` in `package.json`).
Inside this monorepo, workspace consumers still resolve TypeScript sources under
`src/` via package `exports` and path aliases.

```bash
pnpm add @harborclient/core
# or
npm install @harborclient/core
```

Release automation lives in
[`.github/workflows/core-release.yml`](https://github.com/harborclient/harborclient/blob/main/.github/workflows/core-release.yml).
See [Development](/development#releasing-to-npm).
