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

```bash
pnpm add @harborclient/core
# or
npm install @harborclient/core
```
