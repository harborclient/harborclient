# Testing

Testing philosophy, coverage expectations, and patterns for HarborClient contributors.

See also [CONTRIBUTING.md](./CONTRIBUTING.md) for project layout and development setup.

## Philosophy

HarborClient tests focus on **observable behavior**, not implementation details.

- **Behavior over implementation** — assert return values, persisted state, thrown errors, and side effects you care about. Avoid asserting internal call counts unless you are mocking an external boundary.
- **Colocated unit tests** — place tests next to the code they cover as `src/**/*.test.ts` (see `vitest.config.ts`). Vitest does not include `.tsx` files.
- **Contract tests for pluggable backends** — every `IDatabase` implementation runs the shared suite in `src/test/idatabaseContract.ts` via `runIdatabaseContractSuite`.
- **Schema tests at IPC boundaries** — Zod schemas in `src/main/ipc/ipcSchemas.ts` have dedicated tests. New or changed IPC arguments should add parse and reject cases there.
- **Renderer logic, not UI snapshots** — Redux slices, variable substitution, persistence, and orchestration are tested in `.test.ts` files. React components (`.tsx`) rely on manual QA unless Vitest config changes.

## Running tests

```bash
pnpm test          # required before merge
pnpm test:watch    # local iteration only
```

**Always run tests via `pnpm test`**, which uses `scripts/test-with-native.mjs` to:

1. Rebuild native modules (`better-sqlite3`) for system Node
2. Run vitest
3. Restore native modules for Electron

Do **not** run `vitest` or `pnpm exec vitest run` directly — it skips the rebuild/restore cycle and can leave native modules built for the wrong ABI, breaking `pnpm dev` and `pnpm build`.

Use `pnpm test:watch` only when actively iterating on tests; it leaves modules built for system Node until you run `pnpm test` or `pnpm install` again.

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs the full test matrix:

- MySQL and PostgreSQL service containers
- Firebase Auth + Firestore emulators via `firebase emulators:exec`
- `node scripts/test-with-native.mjs` inside the emulator wrapper

All gated backend suites **must pass in CI** — they must not be skipped when `CI=true`.

## Coverage goals (by layer)

There is no enforced line or branch coverage percentage. Expectations are qualitative and layer-based:

| Layer                                | Expectation                                                                                  | Examples                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/shared/`                        | Test pure helpers and serializers                                                            | `formData.test.ts`, `urlencoded.test.ts`                                     |
| `src/main/` (HTTP, scripts, cookies) | Test edge cases and security-relevant behavior                                               | `http/*.test.ts`, `cookieJar/CookieJar.test.ts`, `scripting/scripts.test.ts` |
| `src/main/db/`                       | Every backend runs the contract suite; add backend-specific tests for migrations and routing | `SqliteDatabase.test.ts`, `RoutingDatabase.test.ts`                          |
| `src/main/ipc/`                      | Every new or changed Zod schema gets parse/reject cases                                      | `ipcSchemas.test.ts`                                                         |
| `src/renderer/` (non-UI)             | Redux slices, thunks with testable logic, persistence                                        | `store/*.test.ts`                                                            |
| `src/renderer/` (React `.tsx`)       | Not required by Vitest; manual QA for UI changes                                             | —                                                                            |
| IPC handler wiring (`index.ts`)      | Indirectly covered via module tests; full E2E not required for every handler                 | —                                                                            |

**Lower priority** (manual QA is acceptable): visual UI layout, window chrome, native menus.

## Shared test utilities

Helpers live under `src/test/`:

### `nativeModules.ts`

- `describeSqlite` gates SQLite tests on whether `better-sqlite3` loads under the current Node ABI.
- In CI, if SQLite is unavailable, tests **fail** with a clear error (they must not silently skip).

### `databaseBackends.ts`

- `describeMySql`, `describePostgres`, and `describeFirestore` gate tests on environment configuration.
- Locally, suites skip when the backend is not configured.
- In CI, missing backends **fail** — they must not skip.

Optional local setup (defaults match CI):

| Variable                        | Purpose                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `HARBOR_TEST_MYSQL_HOST`        | MySQL host (default `127.0.0.1`)                                  |
| `HARBOR_TEST_MYSQL_PORT`        | MySQL port (default `3306`)                                       |
| `HARBOR_TEST_MYSQL_USER`        | MySQL user (default `root`)                                       |
| `HARBOR_TEST_MYSQL_PASSWORD`    | MySQL password (default `harborclient`)                           |
| `HARBOR_TEST_MYSQL_DATABASE`    | MySQL database (default `harborclient_test`)                      |
| `HARBOR_TEST_POSTGRES_HOST`     | PostgreSQL host (default `127.0.0.1`)                             |
| `HARBOR_TEST_POSTGRES_PORT`     | PostgreSQL port (default `5432`)                                  |
| `HARBOR_TEST_POSTGRES_USER`     | PostgreSQL user (default `postgres`)                              |
| `HARBOR_TEST_POSTGRES_PASSWORD` | PostgreSQL password (default `harborclient`)                      |
| `HARBOR_TEST_POSTGRES_DATABASE` | PostgreSQL database (default `harborclient_test`)                 |
| `FIRESTORE_EMULATOR_HOST`       | Firestore emulator address (required for Firestore tests locally) |

### `idatabaseContract.ts`

- `baseRequestInput` — minimal `SaveRequestInput` for contract tests.
- `runIdatabaseContractSuite` — shared `IDatabase` behavior every backend must satisfy.

When adding a new database backend, wire it into `databaseBackends.ts` (or an equivalent factory) and call `runIdatabaseContractSuite` from a colocated `*.test.ts` file.

## Writing good tests

Follow patterns in existing tests such as `src/main/http/Requester.test.ts` and `src/renderer/src/store.test.ts`:

- Use descriptive `it('…')` names that state input and expected outcome.
- Prefer Given-When-Then phrasing in names when it clarifies a scenario (e.g. `given empty script, returns passthrough request`).
- Mock Electron when main code calls `app.getPath`:

  ```typescript
  vi.mock('electron', () => ({
    app: { getPath: vi.fn((name: string) => /* … */) }
  }));
  ```

- Use `vi` to stub network, filesystem, or timer boundaries in HTTP and I/O tests.
- Avoid tests that only restate types, trivial getters, or framework behavior.

## When to add tests

Use this checklist when opening a PR:

| Change                                    | Required tests                                                      |
| ----------------------------------------- | ------------------------------------------------------------------- |
| New or changed pure function / serializer | Colocated `*.test.ts`                                               |
| New IPC method                            | Zod schema + `ipcSchemas.test.ts`; module tests for delegated logic |
| New `IDatabase` method                    | Extend `runIdatabaseContractSuite`; implement in all backends       |
| Bug fix                                   | Regression test reproducing the bug                                 |
| HTTP, scripts, or import behavior change  | Extend the relevant existing test file with the edge case           |

## What we do not enforce

- No minimum line or branch coverage percentage.
- No component or snapshot tests until `.tsx` is added to the Vitest config.
- No requirement to run MySQL, PostgreSQL, or Firestore tests locally unless you are changing those backends (CI runs the full matrix).
