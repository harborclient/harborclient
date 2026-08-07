# Team Hub MLS prototype (Step 4 / Task 4.1)

This package is an **isolated proof of concept** for Team Hub end-to-end encrypted
discussion bodies. It lives outside production Team Hub routes and exists to
validate MLS library choice, membership flows, and relay semantics before any
schema or API work in Tasks 4.2–4.5.

## What it proves

The integration test in `tests/discussion_flow.rs` exercises the full prototype
path:

1. **Group creation** — Alice's laptop creates an MLS group for a discussion thread.
2. **Second-device enrollment** — Alice's phone publishes a KeyPackage, receives a relayed welcome, and joins the same group.
3. **Encrypt comment** — Alice encrypts a discussion body locally.
4. **Fake REST/SSE relay** — `FakeRelay` stores commits, welcomes, and ciphertext only (no plaintext).
5. **Decrypt on another client** — Bob decrypts the relayed ciphertext.
6. **Remove member** — Alice removes Bob with an MLS remove commit relayed to remaining members.
7. **Post-removal failure** — Bob cannot encrypt or decrypt comments sent after removal; Alice's phone still can.

Run it:

```bash
cd packages/team-hub-mls-prototype
cargo test
# or
pnpm test
```

Requires Rust (`cargo`) on the PATH. The crate is **not** part of root `pnpm check`.

## Library evaluation

| Criterion                | OpenMLS                                                                                         | mls-rs (AWS)                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| RFC 9420 status          | Mature; widely referenced in MLS ecosystem                                                      | Mature; AWS-backed, strong test vector coverage                                    |
| Stable release used here | **0.8.1** (published)                                                                           | 0.1x on crates.io; active development                                              |
| Documentation            | Book at [openmls.tech](https://openmls.tech), extensive book-code tests                         | Site at [awslabs.github.io/mls-rs](https://awslabs.github.io/mls-rs/)              |
| Node / Electron path     | Experimental WASM wrapper in upstream repo; Discord's `@snazzah/davey` uses OpenMLS via NAPI-RS | `js` feature + community WASM wrappers (e.g. River); fewer production npm packages |
| HarborClient fit         | Matches book examples for add/welcome/commit/remove/message flows used by discussions           | Comparable API surface, less third-party Electron precedent                        |

Both libraries are sound choices for MLS. For HarborClient we prototyped with **OpenMLS 0.8.1** because:

- Stable crates.io release with clear add/welcome/commit/application-message examples.
- Existing Electron precedent (`@snazzah/davey`) for OpenMLS via native bindings.
- Upstream WASM path documented for renderer-side crypto if we avoid native rebuilds.

**Recommendation:** adopt **OpenMLS** for production E2EE, starting with a **Rust NAPI-RS addon** (Electron main process or bundled native module) for v1. Re-evaluate upstream `openmls-wasm` when we need renderer-only crypto without native deps. Keep **mls-rs** as a fallback if OpenMLS WASM/NAPI packaging blockers appear during Task 4.3.

## Proposed production mapping

| Prototype concept                              | Future Team Hub shape                                              |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `DeviceIdentity { user_id, device_id }`        | Per-hub, per-device enrollment (Task 4.3)                          |
| One MLS group per discussion thread            | Map `discussion_thread_id` → MLS group id (Task 4.5)               |
| `FakeRelay` commit/welcome/comment envelopes   | REST rows + optional SSE hints (Tasks 4.4, existing notice stream) |
| Server stores ciphertext + epoch metadata only | E2EE discussion payload columns (Task 4.4)                         |

Important MLS rules captured in the prototype:

- The device that generates a KeyPackage **must** be the same local store that later processes the welcome.
- The member who initiates an add/remove **already merged** the commit; other members process the relayed commit.
- New members join from **welcome**, not from replaying the add commit.

## Packaging implications (Electron / Node / monorepo)

### Option A — NAPI-RS native addon (recommended for v1)

- Build OpenMLS into a `@harborclient/team-hub-mls` native package (pattern similar to `@snazzah/davey`).
- Run crypto from the **Electron main process**; renderer calls IPC for encrypt/decrypt/enroll.
- Add the package name to root `pnpm.onlyBuiltDependencies` before shipping.
- CI must compile for Linux/macOS/Windows target triples used by Electron builds.
- Private keys never enter the renderer; aligns with Task 4.3 secure storage in main.

### Option B — WASM in main or renderer

- Compile OpenMLS with `features = ["js"]` via `wasm-pack --target nodejs` (Node/main) or `--target web` (renderer).
- Simpler cross-platform builds, but larger bundle, slower crypto, and experimental upstream wrapper.
- Renderer WASM keeps keys out of main but complicates hardening vs OS keychain storage.

### Monorepo integration notes

- Keep crypto in a **separate optional package** until Task 4.2 capability gating lands; do not import this prototype from `@harborclient/team-hub` server routes yet.
- Root `pnpm check` should stay TypeScript-only until CI installs Rust and runs `cargo test -p team-hub-mls-prototype` explicitly.
- Do **not** add OpenMLS to the server dependency tree — Team Hub stores ciphertext and relays commits; it must not decrypt bodies.

## Files

| File                       | Role                             |
| -------------------------- | -------------------------------- |
| `src/client.rs`            | Device-scoped MLS client wrapper |
| `src/relay.rs`             | In-memory fake REST/SSE relay    |
| `tests/discussion_flow.rs` | End-to-end flow test             |
| `Cargo.toml`               | OpenMLS 0.8.1 dependencies       |

## Next steps (Tasks 4.2–4.5)

1. Add `collaboration.e2ee` hub capability and session serialization (Task 4.2).
2. Device key onboarding in Electron secure storage + admin revocation API (Task 4.3).
3. Encrypted discussion payload columns and generic notices (Task 4.4).
4. Persist MLS commits for offline catch-up and wire membership to hub user lifecycle (Task 4.5).

No production route should depend on this crate until those tasks land and the native/WASM packaging path is chosen.
