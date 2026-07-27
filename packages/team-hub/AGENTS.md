# @harborclient/team-hub

This package lives in the HarborClient monorepo at `packages/team-hub`. Prefer
running checks from the repo root (`pnpm lint`, `pnpm test`, etc.). Package-
scoped commands use `pnpm --filter @harborclient/team-hub <script>`.

Docs: https://harborclient.com/team-hub/

## Relationship to HarborClient

Team Hub is the **Linux CLI/server** companion to HarborClient desktop. HarborClient
clients connect here for shared storage, auth, plugins, and team LLM.

Keep server-side APIs aligned with HarborClient expectations. Do not copy Electron
or renderer code into this package.

## Linting

While iterating on Team Hub-only changes, run scoped checks:

```bash
pnpm --filter @harborclient/team-hub lint
pnpm --filter @harborclient/team-hub format:check
pnpm --filter @harborclient/team-hub typecheck
pnpm --filter @harborclient/team-hub test
pnpm --filter @harborclient/team-hub build
```

Before finishing, run the full suite from the monorepo root:

```bash
pnpm check
```

## Changelog

`packages/team-hub/CHANGELOG.md` is updated by the monorepo `.githooks/post-commit`
hook when a commit touches `packages/team-hub/**`. Releases use
`pnpm release:team-hub` (`.github/workflows/team-hub-release.yml`, `team-hub-v*` tags).

Do not bump `package.json` version locally — use the release workflow.
