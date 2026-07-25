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

After making code changes, always run from the monorepo root:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Fix any reported issues before finishing the task.

## Changelog

`packages/sdk/CHANGELOG.md` is updated by the monorepo `.githooks/post-commit`
hook when a commit touches `packages/sdk/**`. Releases use
`pnpm release:sdk` (`.github/workflows/sdk-release.yml`, `sdk-v*` tags).

Do not bump `package.json` version locally — use the release workflow.
