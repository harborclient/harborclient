## Development server

Keep `pnpm dev` (or `pnpm dev:gui`) in a dedicated terminal. Agents must not
Ctrl+C that process or reuse its terminal for `pnpm test`, `pnpm check`, or
other commands.

```bash
pnpm dev       # build SDK once, then watch SDK + GUI in parallel
pnpm dev:gui   # Electron / electron-vite only (restart after window close)
pnpm dev:sdk   # SDK tsc --watch + runtime asset copy
```

- Do **not** run `pnpm test` while the GUI is running — the test script rebuilds
  `better-sqlite3` for system Node and restores it for Electron; doing that
  mid-session can break the running app (see [Testing](#testing)).
- When the terminal shows `apps/gui dev: Done` but the SDK watcher is still
  running, restart with `pnpm dev:gui` only.
- For SDK UI component work, `pnpm dev:gui` alone is enough for HMR (Vite
  resolves `@harborclient/sdk` to source). Run `pnpm dev:sdk` when you need
  fresh `dist/` types or SDK package test output.

## Linting

Prefer scoped checks while iterating so concurrent agents do not all hammer the
full monorepo suite. Filter to the packages you changed:

```bash
pnpm --filter @harborclient/gui lint
pnpm --filter @harborclient/gui typecheck
pnpm --filter @harborclient/gui format:check
pnpm test:changed
```

Common filters: `@harborclient/gui`, `@harborclient/sdk`, `@harborclient/core`,
`@harborclient/http`, `@harborclient/storage-sqlite`, `@harborclient/team-hub`,
`@harborclient/team-hub-api`, `@harborclient/harborclient`. Skip `format:check`
on a filter when that package has no such script (use root `pnpm format:check`
only if you need a full format pass).

If you changed the SDK public API, run `pnpm build:sdk` and also check
dependents that import it.

Before finishing a task, run the orchestrated full suite once from the repo
root (one SDK build, then lint / format / typecheck / test in parallel):

```bash
pnpm check
```

Do **not** run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and
`pnpm test` as four separate root commands — that rebuilds the SDK twice and
serializes work `pnpm check` already parallelizes. Fix any reported issues
before finishing the task.

## Testing

Always run tests via the pnpm scripts below — never `vitest` or
`pnpm exec vitest run` directly. Those scripts rebuild native modules
(`better-sqlite3`) for system Node, run vitest, then restore them for Electron.
Skipping this leaves the wrong ABI and breaks `pnpm dev` / `pnpm build`.

Tests are colocated as `**/*.test.ts` under each package. See [TESTING.md](./TESTING.md) for
philosophy, coverage goals, and when to add tests.

```bash
pnpm test:changed         # fast iteration — tests affected by git changes
pnpm test                 # full suite (also covered by pnpm check)
pnpm test:gui             # Electron GUI package only
pnpm --filter @harborclient/core test
```

## Package manager

Use `pnpm` only. Lockfile is `pnpm-lock.yaml`. Do not use npm or yarn.

## Dependencies and scope

- Do not add new dependencies without maintainer approval.
- Avoid large refactors unless explicitly requested.
- New native deps must be added to `pnpm.onlyBuiltDependencies` in
  `package.json`.

## Documentation site

User-facing docs and plugin marketplace metadata live in the separate
[harborclient-site](https://github.com/harborclient/harborclient-site)
repository. Edit docs there and deploy with Docker (Nginx on port 8080).

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

## HarborClient style

When creating blog featured images, marketing visuals, or other brand-adjacent
assets, use the "HarborClient style": See BRANDING.md.

## Architecture

See [CONTRIBUTING.md](./CONTRIBUTING.md) for project layout, the IPC contract
(`src/shared/types/` → `src/preload/index.ts` → `src/main/ipc/index.ts`), code
style, and path aliases.

## User interface

Never use native browser dialogs (`alert`, `confirm`, `prompt`) in the renderer.
They block the Electron renderer thread and break visual consistency.

- Default body text inherits 16px from `body`; Do not use text-[14px]
- Use custom modals built on [`Modal`](src/renderer/src/components/Modal/index.tsx) for
  blocking messages and confirmations (`AlertModal`, `ConfirmModal`, or
  feature-specific dialogs like `QuitPrompt`).
- Show errors inline (`text-danger`) when the user is already inside a modal or
  settings form.
- Use `react-hot-toast` only for non-blocking success or info feedback, not for
  errors that require acknowledgment.

Helpers live in [`dialogHelpers.ts`](src/renderer/src/ui/Modals/dialogHelpers.ts)
(`showAlert`, `showConfirm`) and [`useConfirm`](src/renderer/src/hooks/useConfirm.ts).

### Accessibility

Treat accessibility as a first-class requirement for renderer UI work — not an
optional follow-up. When adding or changing UI, keyboard and screen-reader
support should be designed in from the start. See [FIXES.md](./FIXES.md) for a
detailed audit of known gaps and proposed fixes.

**Interactive elements**

- Use native `<button>`, `<input>`, `<select>`, and `<textarea>` where
  possible. Do not attach `onClick` to `<div>`/`<span>` without `role`,
  `tabIndex`, and keyboard handlers — prefer a real `<button type="button">`.
- Icon-only buttons must have an `aria-label`. Do not rely on `title` as the
  sole accessible name. Keep inner icons decorative (`FaIcon` defaults to
  `aria-hidden`).
- Controls hidden until hover must still appear on keyboard focus — use
  `focus-visible:opacity-100` / `group-focus-within:opacity-100`, not hover
  alone (see `iconButton` in [`classes.ts`](src/renderer/src/ui/Shared/classes.ts)).
- Set `type="button"` on buttons that are not form submit actions.

**Forms and labels**

- Every control needs a programmatic label: `<label htmlFor>` + matching `id`,
  wrapping `<label>`, or `aria-label` / `aria-labelledby`. Placeholder text is
  not a label.
- When a label targets a child component (`VariableInput`, `CodeEditor`), that
  component must accept and forward `id` and/or `aria-*` props to the underlying
  control.
- Validation errors need more than color: set `aria-invalid` and link the error
  text with `aria-describedby`.

**Dialogs and dynamic content**

- Build blocking dialogs on [`Modal`](src/renderer/src/components/Modal/index.tsx) with
  `role="dialog"`, `aria-modal`, an accessible name (`aria-labelledby` or
  `aria-label`), focus trap, initial focus, and focus restoration on close. Do
  not hand-roll one-off overlays.
- Announce important status changes (loading, sending, errors) with
  `role="status"` or `aria-live="polite"`. Follow the pattern in
  [`BusyIndicator`](packages/sdk/src/components/BusyIndicator/index.tsx) (`@harborclient/sdk/components`).
- Expose selection and expansion state with `aria-current`, `aria-selected`, and
  `aria-expanded` — not color or background alone.

**Custom widgets**

- Tab bars and segmented controls must follow a WAI-ARIA pattern (`tablist` /
  `tab` / `tabpanel`, or `radiogroup` / `radio` for single-choice pickers). See
  [`SegmentedTabs`](src/renderer/src/components/SegmentedTabs/index.tsx).
- Drag-and-drop must have a keyboard-operable alternative (e.g. dnd-kit
  `KeyboardSensor` or explicit move actions in a menu).
- Resize handles and other custom controls need keyboard support and a visible
  focus indicator.

**Visual design**

- Do not convey information by color alone (status dots, pass/fail, errors).
  Pair color with text or an accessible name; mark decorative indicators
  `aria-hidden`.
- Check contrast for `text-muted` and small labels against WCAG 4.5:1 where
  they carry meaning.
- Respect `prefers-reduced-motion` for animations and spinners.
- **Minimum font size:** Never use font sizes below **14px** in renderer UI.
  Avoid `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-xs`, and `prose-sm`
  (Typography’s `sm` preset can render nested elements smaller than 14px).
  Default body text inherits **16px** from `body` (set in `@harborclient/sdk/styles.css`);
  do not add `text-[16px]` for ordinary labels, body text, or metadata. Use
  `text-[14px]` or `text-[15px]` only when a smaller tier is intentional.
  Headings may be larger (`text-[18px]`, `text-[20px]`, etc.).

When fixing existing UI, prefer improving shared primitives (`Modal`,
`SegmentedTabs`, `VariableInput`, shared button classes) so one change lifts
many call sites.

## Documentation

Always add clear, useful documentation when you write or change code. Match the
JSDoc style already used in the codebase (see `src/renderer/src/ui/Main/RequestEditor/Editor/`
and [`VariableInput`](packages/sdk/src/components/VariableInput/index.tsx) (`@harborclient/sdk/components`) for examples).

When adding or renaming a public plugin `hc.*` API, update
`packages/sdk/docs/.vitepress/hc_sdk_manifest.json` and the matching
`<HcMethod />` docs page in the same change. See
[`packages/sdk/AGENTS.md`](packages/sdk/AGENTS.md) → **Plugin API docs
(`hc_sdk_manifest.json`)** for the `since` version rules.

**Every function** — exported or local, component or helper — must have a JSDoc
docblock. Explain what the function does and why, not just restate its name.
Document parameters with `@param`, return values with `@returns` when non-void,
and thrown errors with `@throws` when relevant.

**Every `useEffect` and `useMemo`** must have a docblock directly above the hook
call. For `useEffect`, describe the side effect, what triggers it, and any
cleanup. For `useMemo`, describe what is being derived and why memoization
matters.

**Props and types** — document non-obvious fields on interfaces and type aliases
with inline JSDoc comments. Name component props interfaces `Props` (not
`ComponentNameProps`).

**Docblock format** — never use single-line docblocks (`/** ... */`). Always
use multi-line blocks:

```ts
/**
 * Description here.
 */
```

When you touch existing code, add or improve docblocks for any functions or
hooks you modify. Prefer concise prose over repeating identifiers; a reader
should understand intent without opening the implementation.

## Changelog

Git hooks live in `.githooks/` (activated by `pnpm install` via the `prepare`
script, which sets `core.hooksPath` to `.githooks` and wraps `git pull` with
[`scripts/safe-pull.sh`](scripts/safe-pull.sh)).

Changelogs are kept up to date automatically by the `post-commit` hook in
`.githooks/post-commit`:

- Root [`CHANGELOG.md`](CHANGELOG.md) — every meaningful commit (desktop app /
  monorepo history). Renamed by [`.github/workflows/release.yml`](.github/workflows/release.yml).
- [`packages/core/CHANGELOG.md`](packages/core/CHANGELOG.md) — commits that
  touch `packages/core/**`. Renamed by
  [`.github/workflows/core-release.yml`](.github/workflows/core-release.yml)
  when publishing `@harborclient/core` to npm (`core-v*` tags).
- [`packages/sdk/CHANGELOG.md`](packages/sdk/CHANGELOG.md) — commits that
  touch `packages/sdk/**`. Renamed by
  [`.github/workflows/sdk-release.yml`](.github/workflows/sdk-release.yml)
  when publishing `@harborclient/sdk` to npm (`sdk-v*` tags).
- [`packages/http/CHANGELOG.md`](packages/http/CHANGELOG.md) — commits that
  touch `packages/http/**`. Renamed by
  [`.github/workflows/http-release.yml`](.github/workflows/http-release.yml)
  when publishing `@harborclient/http` to npm (`http-v*` tags).
- [`packages/live-server/CHANGELOG.md`](packages/live-server/CHANGELOG.md) — commits that
  touch `packages/live-server/**`. Renamed by
  [`.github/workflows/live-server-release.yml`](.github/workflows/live-server-release.yml)
  when publishing `@harborclient/live-server` to npm (`live-server-v*` tags).
- [`packages/team-hub/CHANGELOG.md`](packages/team-hub/CHANGELOG.md) — commits that
  touch `packages/team-hub/**`. Renamed by
  [`.github/workflows/team-hub-release.yml`](.github/workflows/team-hub-release.yml)
  when publishing `@harborclient/team-hub` to npm (`team-hub-v*` tags).
- [`packages/team-hub-api/CHANGELOG.md`](packages/team-hub-api/CHANGELOG.md) — commits that
  touch `packages/team-hub-api/**`. Renamed by
  [`.github/workflows/team-hub-api-release.yml`](.github/workflows/team-hub-api-release.yml)
  when publishing `@harborclient/team-hub-api` to npm (`team-hub-api-v*` tags).

How it works:

- After each commit, the hook prepends `- <commit subject>. (\`<short sha>\`)`to the relevant`## Unreleased` section(s) and amends the change into the
  same commit.
- The hook stays out of the way when:
  - That changelog file is already part of the commit (you wrote your own entry).
  - The commit is a merge, revert, fixup, squash, or `chore(changelog)` /
    `chore(release)` commit.
  - The commit subject is a bare version number like `0.4.9` or `v1.2.3`.
  - A rebase, cherry-pick, revert, or merge is in progress.
  - The commit's short SHA is already present in `## Unreleased`.

What this means for you:

- Write a clear, single-line commit subject — it becomes the changelog entry.
- If you want a more detailed entry than the subject line, edit `## Unreleased`
  yourself and stage the changelog as part of the commit. The hook will detect
  it and leave your entry alone.
- Don't add version numbers or dates manually. The desktop release workflow
  bumps `apps/harborclient/package.json`; the core, SDK, http, live-server,
  team-hub, and team-hub-api workflows bump their package `package.json` files
  and publish to npm.
- Don't run version-bump commands locally (`pnpm version`, `npm version`,
  etc.); use the release workflows instead so the changelog and tags stay in sync.
- Core npm releases: `pnpm release:core` (or `release:core:minor` /
  `release:core:major`). Requires repository secret `NPM_TOKEN`.
- SDK npm releases: `pnpm release:sdk` (or `release:sdk:minor` /
  `release:sdk:major`). Requires the same `NPM_TOKEN` secret.
- http npm releases: `pnpm release:http` (or `release:http:minor` /
  `release:http:major`). Requires the same `NPM_TOKEN` secret.
- Live-server npm releases: `pnpm release:live-server` (or
  `release:live-server:minor` / `release:live-server:major`). Requires the same
  `NPM_TOKEN` secret.
- Team Hub npm releases: `pnpm release:team-hub` (or `release:team-hub:minor` /
  `release:team-hub:major`). Requires the same `NPM_TOKEN` secret.
- Team Hub API npm releases: `pnpm release:team-hub-api` (or
  `release:team-hub-api:minor` / `release:team-hub-api:major`). Requires the
  same `NPM_TOKEN` secret.

### Pulling after a release

The release workflow commits an updated `CHANGELOG.md` on `main`. If you also
have local changelog differences — uncommitted edits or entries added by the
post-commit hook in commits not yet on upstream — a normal pull can produce a
merge conflict.

After `pnpm install`, `git pull` runs through `scripts/safe-pull.sh`, which
fetches upstream and **aborts early** when `CHANGELOG.md` differs locally
(working tree, index, or `HEAD` since merge-base) and upstream also changed it
since merge-base. The `pre-rebase` hook applies the same check for
`git pull --rebase` and other rebases.

If the guard blocks you:

1. After a release landed on `main`, prefer taking upstream's file and
   re-applying your `## Unreleased` lines:
   `git fetch origin && git checkout origin/main -- CHANGELOG.md`
2. For uncommitted edits only, you can instead discard or stash:
   `git restore -- CHANGELOG.md` or `git stash push -- CHANGELOG.md`
3. Pull again.

To bypass the guard once: `git -c alias.pull= pull`.
