# @harborclient/sdk

This package lives in the HarborClient monorepo at `packages/sdk`. Prefer
running checks from the repo root (`pnpm lint`, `pnpm test`, etc.). Package-
scoped commands use `pnpm --filter @harborclient/sdk <script>`.

Docs: https://harborclient.github.io/harborclient/sdk/

## React components

Every React component lives in its own file. Do not define more than one
component in a single module.

Primary components use a directory named after the component, with the
component in `index.tsx`:

```
src/components/Navbar/index.tsx   # export function Navbar
```

When a primary component needs helpers, put each helper in a sibling file in
the same directory — never in `index.tsx` alongside the primary:

```
src/components/Navbar/index.tsx      # Navbar
src/components/Navbar/NavItem.tsx    # NavItem
src/components/Navbar/NavSearch.tsx  # NavSearch
```

If a file already exports a primary component plus sub-components, split it the
same way: create (or use) the directory named after the primary, move the
primary to `index.tsx`, and give each sub-component its own file.

Related component families that share a directory (for example `SidebarItem/`)
still follow one component per file; each named file in that directory is a
single component (`SidebarRequestItem.tsx`, `SidebarTreeGroup.tsx`, and so on).

## Linting

While iterating on SDK-only changes, run scoped checks:

```bash
pnpm --filter @harborclient/sdk lint
pnpm --filter @harborclient/sdk format:check
pnpm --filter @harborclient/sdk typecheck
pnpm --filter @harborclient/sdk test
```

The SDK's public API is consumed by other packages through its `dist/` output,
so if you changed exported types or components, build it (`pnpm build:sdk`
from the root) and check dependents too. Before finishing, run the full suite
from the monorepo root:

```bash
pnpm check
```

Fix any reported issues before finishing the task.

## Changelog

`packages/sdk/CHANGELOG.md` is updated by the monorepo `.githooks/post-commit`
hook when a commit touches `packages/sdk/**`. Releases use
`pnpm release:sdk` (`.github/workflows/sdk-release.yml`, `sdk-v*` tags).

Do not bump `package.json` version locally — use the release workflow.
