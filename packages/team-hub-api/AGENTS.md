# @harborclient/team-hub-api

This package lives in the HarborClient monorepo at `packages/team-hub-api`. Prefer
running checks from the repo root (`pnpm lint`, `pnpm test`, etc.). Package-
scoped commands use `pnpm --filter @harborclient/team-hub-api <script>`.

Docs: https://harborclient.com/team-hub-api/

## Linting

While iterating on package-only changes, run scoped checks:

```bash
pnpm --filter @harborclient/team-hub-api lint
pnpm --filter @harborclient/team-hub-api format:check
pnpm --filter @harborclient/team-hub-api typecheck
pnpm --filter @harborclient/team-hub-api test
pnpm --filter @harborclient/team-hub-api build
```

Before finishing, run the full suite from the monorepo root:

```bash
pnpm check
```

## Changelog

`packages/team-hub-api/CHANGELOG.md` is updated by the monorepo `.githooks/post-commit`
hook when a commit touches `packages/team-hub-api/**`. Releases use
`pnpm release:team-hub-api` (`.github/workflows/team-hub-api-release.yml`,
`team-hub-api-v*` tags).

Do not bump `package.json` version locally — use the release workflow.
