# Git-backed collections

HarborClient can store collections as version-controlled files inside a git repository. Link a local clone, edit collections in the app, commit and push from the **Source control** panel, and share changes with your team through normal git workflows.

Git-backed storage is a **storage connection type** in [Settings → Storage Locations](/settings#storage-locations). Each git connection points at a repository working tree on your machine. Collections for that connection are written under a configurable subdirectory (default `.harborclient/`).

![Git-backed collections](images/screenshots/hc-12.png)

## When to use git

| Approach | Best for |
| --- | --- |
| **Git provider** | Teams that already use git for API definitions; reviewable diffs, branches, and PRs |
| **Export/Import** | One-off snapshots or archives as a single `.json` file |
| **Invites** | Live shared collections on Firestore, MySQL, or PostgreSQL |
| **Team hubs** | HarborClient Team Hub token-based sharing |

Use git when you want collections to live in a repo alongside application code or infrastructure, with history and merge workflows your team already uses.

## Setup

1. Clone the repository locally (HTTPS URL).
2. Open **File → Settings → Storage Locations** and click **Add storage location**.
3. Choose type **Git** and configure:
   - **Repository path** — absolute path to your local clone
   - **Repository URL (HTTPS)** — remote URL used for fetch/push (`isomorphic-git` does not support SSH keys)
   - **Branch** — branch to track (for example `main`)
   - **HarborClient subdirectory** — where collection files are stored (default `.harborclient`)
4. Authenticate for private repositories (see [Authentication](#authentication)).
5. Restart HarborClient so the connection is mounted at launch.

On first use HarborClient creates the subdirectory layout and a `.gitignore` for local environment overrides.

## File layout

Each collection is a directory with a manifest and one file per saved request:

```
.harborclient/
  .gitignore
  collections/
    <uuid>-<slug>/
      collection.json          # name, variables, headers, auth, scripts, folder order
      requests/
        <uuid>-<slug>.json     # one saved request per file
  environments/
    <uuid>-<slug>.json         # shared environments (values masked per Share flag)
```

`collection.json` matches the HarborClient collection export shape except requests live in `requests/` instead of a `requests[]` array. This keeps diffs small and limits merge conflicts to individual requests.

Variables with **Share** unchecked are masked (value cleared) when written to disk, same as manual export.

### Local environment overrides

The generated `.gitignore` ignores local-only environment files:

- `environments/local*.json`
- `environments/*-local.json`

Commit shared environment definitions in the main `environments/` files; keep secrets in ignored local override files on each machine.

## Source control in the app

Git-backed connections show an amber badge on collection rows when the working tree has uncommitted changes (staged, unstaged, or untracked files under the HarborClient subdirectory).

![Source control](images/screenshots/hc-13.png)

Open **Source control** from a collection row menu to:

- View branch name and change count
- **Commit** with a message (stages all changes under the HarborClient subdirectory)
- **Pull** (fetch + merge) and **Push**
- See recent commits

HarborClient reloads collections after pull and when files change on disk (for example after an external `git pull`). A file watcher and window-focus refresh keep the sidebar in sync with the repository.

### Merge conflicts

If git merge conflict markers (`<<<<<<<`) appear in collection or environment JSON files, HarborClient reports the conflict count in the source-control panel and shows a warning toast. Resolve markers in your editor, then pull or reload again. Invalid JSON with conflict markers cannot be parsed until resolved.

## Authentication

Private HTTPS remotes require credentials. HarborClient stores tokens encrypted via the same secret storage used for AI API keys — not in the plaintext connection JSON.

| Method | Scope |
| --- | --- |
| **Personal access token (PAT)** | Any git host (GitHub, GitLab, Bitbucket, self-hosted). Enter username (often `token` or your username) and the token in git connection settings. |
| **Authorize with GitHub** | GitHub.com only. Uses OAuth device flow: approve in the browser, then complete authorization in settings. No client secret is required. |

Both methods feed the same HTTPS authentication path used for fetch, pull, and push.

### Custom GitHub OAuth App (Advanced)

By default, **Authorize with GitHub** uses HarborClient's built-in OAuth App. Teams that require their own app (org policy, audit, or approval workflows) can register a GitHub OAuth App and enter its **Client ID** under **Advanced** in git connection settings.

1. In your GitHub organization: **Settings → Developer settings → OAuth Apps → New OAuth App** (or create an organization-owned app).
2. Enable **Device Flow** for the app.
3. Request the **`repo`** scope when users authorize (HarborClient requests this during device flow).
4. Copy the **Client ID** — no client secret is required for device flow.
5. If your organization restricts third-party apps, an admin must approve the app for the org.
6. In HarborClient: open the git connection, expand **Advanced**, paste the Client ID, save the connection, then authorize with GitHub.

Leave the Client ID blank to keep using HarborClient's built-in app. If you change the Client ID after authorizing, revoke GitHub authorization and authorize again so tokens match the new app.

### HTTPS only

HarborClient uses `isomorphic-git` over HTTPS. SSH remotes and SSH keys are not supported. If your team uses SSH URLs, create a PAT for HTTPS access or use external git tooling for push/pull while still editing files through HarborClient.

## Provider badge and invites

Collections on a git connection show the connection name badge like other non-active storage locations. **Invite** is hidden for git-backed collections — sharing is through the repository, not HarborClient invite tokens.

## What's next

- [Collections](/collections) — sidebar, folders, and export/import
- [Settings → Storage Locations](/settings#storage-locations) — connection types and management
- [Environments](/environments) — global variable groups stored per backend
