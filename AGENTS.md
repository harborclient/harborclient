## Linting

After making code changes, always run:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Fix any reported issues before finishing the task.

## Testing

Always run tests via `pnpm test` — never `vitest` or `pnpm exec vitest run`
directly. The test script rebuilds native modules (`better-sqlite3`) for system
Node, runs vitest, then restores them for Electron. Skipping this leaves the
wrong ABI and breaks `pnpm dev` / `pnpm build`.

Tests are colocated as `src/**/*.test.ts`. See [TESTING.md](./TESTING.md) for
philosophy, coverage goals, and when to add tests.

## Package manager

Use `pnpm` only. Lockfile is `pnpm-lock.yaml`. Do not use npm or yarn.

## Dependencies and scope

- Do not add new dependencies without maintainer approval.
- Avoid large refactors unless explicitly requested.
- New native deps must be added to `pnpm.onlyBuiltDependencies` in
  `package.json`.

## Generated files

Never commit `docs/.vitepress/cache/` (VitePress build cache). Do not hand-edit
generated docs nav — use `pnpm docs:build:nav`.

## Architecture

See [CONTRIBUTING.md](./CONTRIBUTING.md) for project layout, the IPC contract
(`src/shared/types.ts` → `src/preload/index.ts` → `src/main/ipc/ipc.ts`), code
style, and path aliases.

## Documentation

Always add clear, useful documentation when you write or change code. Match the
JSDoc style already used in the codebase (see `src/renderer/src/ui/Request/Editor/`
and `src/renderer/src/components/VariableInput.tsx` for examples).

**Every function** — exported or local, component or helper — must have a JSDoc
docblock. Explain what the function does and why, not just restate its name.
Document parameters with `@param`, return values with `@returns` when non-void,
and thrown errors with `@throws` when relevant.

**Every `useEffect` and `useMemo`** must have a docblock directly above the hook
call. For `useEffect`, describe the side effect, what triggers it, and any
cleanup. For `useMemo`, describe what is being derived and why memoization
matters.

**Props and types** — document non-obvious fields on interfaces and type aliases
with inline JSDoc comments.

When you touch existing code, add or improve docblocks for any functions or
hooks you modify. Prefer concise prose over repeating identifiers; a reader
should understand intent without opening the implementation.

## Changelog

`CHANGELOG.md` is kept up to date automatically by the `post-commit` hook in
`.githooks/post-commit` (activated by `pnpm install` via the `prepare` script,
which sets `core.hooksPath` to `.githooks`).

How it works:

- After each commit, the hook prepends `- <commit subject>. (\`<short sha>\`)`to
the`## Unreleased` section and amends the change into the same commit.
- The hook stays out of the way when:
  - `CHANGELOG.md` is already part of the commit (you wrote your own entry).
  - The commit is a merge, revert, fixup, squash, or `chore(changelog)` /
    `chore(release)` commit.
  - The commit subject is a bare version number like `0.4.9` or `v1.2.3`.
  - A rebase, cherry-pick, revert, or merge is in progress.
  - The commit's short SHA is already present in `## Unreleased`.

What this means for you:

- Write a clear, single-line commit subject — it becomes the changelog entry.
- If you want a more detailed entry than the subject line, edit `## Unreleased`
  yourself and stage `CHANGELOG.md` as part of the commit. The hook will detect
  it and leave your entry alone.
- Don't add version numbers or dates manually. The release workflow
  (`.github/workflows/release.yml`) bumps `package.json` and renames
  `## Unreleased` to `## <new version> - <YYYY-MM-DD>` when a maintainer
  triggers a release.
- Don't run version-bump commands locally (`pnpm version`, `npm version`,
  etc.); use the release workflow instead so the changelog and tags stay in sync.
