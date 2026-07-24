# Development

From the monorepo root:

```bash
pnpm --filter @harborclient/core lint
pnpm --filter @harborclient/core typecheck
pnpm --filter @harborclient/core test
pnpm --filter @harborclient/core build
```

Docs (this site):

```bash
pnpm --filter @harborclient/core docs:serve   # VitePress + nav watcher
pnpm --filter @harborclient/core docs:build   # production build
```

Always run tests via `pnpm test` at the monorepo root (or the filter scripts above) — do not invoke `vitest` directly, so native module ABIs stay aligned with Electron.

## Releasing to npm

`@harborclient/core` publishes to the npm registry via
[`.github/workflows/core-release.yml`](https://github.com/harborclient/harborclient/blob/main/.github/workflows/core-release.yml).
It is separate from the desktop app `release.yml` workflow.

Automatic releases run on pushes to `main` that touch `packages/core/**` when
`packages/core/CHANGELOG.md` has `## Unreleased` content (patch bump), or when
the current package version has no matching `core-v*` tag. Manual releases:

```bash
pnpm release:core          # patch
pnpm release:core:minor
pnpm release:core:major
# or
gh workflow run core-release.yml --ref main -f branch=main -f bump=minor
```

Commits that change `packages/core/**` append to both the root `CHANGELOG.md`
and `packages/core/CHANGELOG.md` via the post-commit hook. Do not bump
`packages/core/package.json` locally — let the workflow own version tags
(`core-v*`) and npm publish.

Requires the repository secret `NPM_TOKEN` with publish rights to
`@harborclient/core`.
