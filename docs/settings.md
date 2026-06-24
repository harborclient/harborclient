# Settings

HarborClient application settings control appearance, HTTP request defaults, and the storage connections where collections, requests, and environments are stored. Open settings from **File → Settings** or **Cmd/Ctrl+,**.

The settings panel has a sidebar with seven sections: **General**, **Syntax highlighting**, **Shortcuts**, **Proxy**, **Storage Locations**, **AI**, and **Backup & Restore**. General covers appearance and request defaults; Syntax highlighting controls the code editor; Shortcuts lets you customize keyboard shortcuts; Proxy configures a global HTTP proxy for outbound requests; Storage Locations manages the named storage connections that hold your data; AI stores API keys for the built-in assistant; Backup & Restore exports or replaces all local HarborClient data from a single backup file.

Appearance, request defaults, and connection definitions are stored in electron-store on your machine. Collections, requests, and environments live in the storage connections you configure.

## General

![General](images/screenshots/hc-2.png)

### Theme

Choose how HarborClient looks:

| Option | Description |
| --- | --- |
| **Light** | Always use the light theme |
| **Dark** | Always use the dark theme |
| **System** | Match your operating system preference |

Theme changes apply immediately and do not require a restart or a save.

### Request defaults

Control how HarborClient sends requests and handles responses:

| Field | Description |
| --- | --- |
| **Request timeout (ms)** | Abort a request after this many milliseconds. Set to `0` to disable the limit. |
| **Max response size (MB)** | Stop reading a response larger than this size. Set to `0` for no configurable limit (512 MB hard cap still applies). |
| **SSL certificate verification** | When enabled, reject requests with invalid TLS certificates. |

Click **Save** to apply request defaults.

## Shortcuts

![Shortcuts](images/screenshots/hc-3.png)

The **Shortcuts** section lists every configurable keyboard shortcut in HarborClient. Each row shows the action name and its current key combination.

| Action | Description |
| --- | --- |
| **Click a key combination** | Enter recording mode, then press the desired keys to assign a new shortcut |
| **Restore defaults** | Reset all shortcuts to their built-in defaults (requires confirmation) |

Shortcut changes apply immediately when valid. Duplicate or invalid combinations are shown inline and are not saved.

Configurable shortcuts include File menu actions (new request, save request, settings), Edit menu actions (undo, copy, paste), and View menu actions (full screen, zoom). Some actions such as **Send** still use **Enter** when the URL field is focused and are not listed here.

## Proxy

![Proxy](images/screenshots/hc-4.png)

The **Proxy** section configures a global HTTP proxy applied to every outbound request.

| Field | Description | Default |
| --- | --- | --- |
| **Use a proxy** | Route all requests through the configured proxy server | Off |
| **Protocol** | Protocol used to connect to the proxy (`HTTP` or `HTTPS`) | HTTP |
| **Host** | Proxy server hostname or IP address | (empty) |
| **Port** | Proxy server port | `8080` |
| **Use basic authentication** | Send HTTP Basic credentials to the proxy | Off |
| **Username** | Username for proxy authentication | (empty) |
| **Password** | Password for proxy authentication | (empty) |

Click **Save** to apply proxy settings. When the proxy is enabled but the host is empty, requests are sent directly without a proxy.

## Storage Locations

![Storage Locations](images/screenshots/hc-5.png)

The **Storage Locations** section lists every named storage connection. The **active** storage location is used for new collections and imports. Individual collections can be moved to other storage locations from collection settings.

All configured storage locations are opened at launch, so shared collections from any connection are available immediately.

**Team hubs** are configured separately under **File → Team Hub**, not in this section. They connect to [HarborClient Team Hub](/team-hubs) for token-based shared collections. See [Team hubs](/team-hubs) for setup and sync behavior.

### Managing connections

| Action | Description |
| --- | --- |
| **Add storage location** | Create a new connection. Choose a name and type, then configure its connection details. |
| **Set active** | Mark a connection as the active storage location for new data. |
| **Edit** | Change a connection's name and connection details. The type cannot be changed after creation. |
| **Delete** | Remove a connection. The last remaining connection cannot be deleted, and the last remaining SQLite connection cannot be deleted. Deleting the active storage location promotes another connection to active after restart. |

Connection changes take effect after restarting HarborClient.

### Connection types

Each connection has a name and one of the following types. The type is chosen when the connection is created and is fixed afterward.

#### SQLite

A local database file stored in the HarborClient application data directory. This is the default type.

| Field | Description |
| --- | --- |
| **Database filename** | Filename of the database file within the application data directory |

#### Firestore

Stores data in a shared Firebase project. Use this type for cloud-backed storage or team access to the same data.

| Field | Description |
| --- | --- |
| **API key** | Firebase Web API key |
| **Auth domain** | Firebase Auth domain |
| **Project ID** | Firebase project ID |
| **App ID** | Firebase app ID |
| **Email** | Email for Firebase Auth sign-in |
| **Password** | Password for Firebase Auth sign-in |

#### MySQL

Stores data on a remote MySQL server. Use this type for self-hosted or team-shared storage.

| Field | Description | Default |
| --- | --- | --- |
| **Host** | MySQL server hostname | `127.0.0.1` |
| **Port** | MySQL server port | `3306` |
| **User** | MySQL username | (empty) |
| **Password** | MySQL password | (empty) |
| **Database** | MySQL storage location name | (empty) |

#### PostgreSQL

Stores data on a remote PostgreSQL server. Use this type for self-hosted or team-shared storage.

| Field | Description | Default |
| --- | --- | --- |
| **Host** | PostgreSQL server hostname | `127.0.0.1` |
| **Port** | PostgreSQL server port | `5432` |
| **User** | PostgreSQL username | (empty) |
| **Password** | PostgreSQL password | (empty) |
| **Database** | PostgreSQL storage location name | (empty) |

#### Git

Stores collections as files in a local git repository working tree. Use this type to version API collections with your team through normal git workflows. See [Git provider](/git-provider) for file layout, authentication, and source-control behavior.

| Field | Description | Default |
| --- | --- | --- |
| **Repository path** | Absolute path to the local repository clone | (empty) |
| **Repository URL (HTTPS)** | Remote URL for fetch/push (SSH not supported) | (empty) |
| **Branch** | Branch to track | `main` |
| **HarborClient subdirectory** | Directory inside the repo for collection files | `.harborclient` |

Authenticate private remotes with a personal access token or **Authorize with GitHub** (device flow). Tokens are stored encrypted, not in the connection JSON.

When you use a remote type such as Firestore, MySQL, or PostgreSQL, multiple HarborClient instances can point at the same database to share collections, environments, and saved requests across your team. Changes from other users appear when you reload data (for example, after restarting the app or refreshing collections); HarborClient does not live-sync in the background. Git-backed connections reload from disk when you pull, when files change under the HarborClient subdirectory, or when the window regains focus.

## AI

![AI](images/screenshots/hc-6.png)

The **AI** section stores API keys for OpenAI, Claude, and Google Gemini. Keys are encrypted and saved locally on your machine. HarborClient uses the OS keychain when available; on systems without Secret Service support it falls back to a local encryption key in your application data directory. Saved keys power the AI sidebar chat. See [AI assistant](/ai) for setup and usage.

On Linux, OS-backed encryption typically requires **GNOME Keyring** or **KWallet** to be running.

| Field | Description |
| --- | --- |
| **OpenAI API key** | API key for OpenAI models |
| **Claude API key** | API key for Anthropic Claude models |
| **Google Gemini API key** | API key for Google Gemini models |

Click **Save** to persist API keys.

## Backup & Restore

The **Backup & Restore** section exports everything HarborClient stores locally on your machine into a single **HarborClient Backup** file (`.hcb`), or restores your local data from such a file. Use it when moving to a new computer, before reinstalling, or to keep an offline snapshot of your workspace.

| Action | Description |
| --- | --- |
| **Export backup** | Opens a save dialog and writes a `.hcb` file containing your local HarborClient data |
| **Restore from backup** | Opens a file picker for `.hcb` files, replaces your current local data, and restarts the app |

Restore asks for confirmation first. It overwrites local data and may discard unsaved work in open request tabs. HarborClient restarts automatically when restore completes.

### What is included

A backup captures local application data under HarborClient's user data directory, including:

- Local SQLite databases (registry, default provider database, and Team Hub ID maps) and their WAL sidecars
- Electron-store settings (panel layout, sidebar expansion, editor tabs, and similar UI state)
- Window position and size
- Storage connection definitions, environments, AI chat history, cookies, and collection routing stored in the registry
- Encrypted AI and git credentials, sharing identity keys, and the local encryption key file
- Git provider sidecar files (`git-index/`, `git-provider-settings/`)
- Renderer UI state such as open tabs, the active environment, and panel sizes

Backups are zip archives with a `.hcb` extension. They include secrets in readable form inside the archive—store backup files securely and do not share them.

### What is not included

Restore replaces **local** HarborClient state only. It does not copy data that lives elsewhere:

- **Remote storage locations** (Firestore, MySQL, PostgreSQL) — only connection settings are backed up; server-side collections and environments are unchanged
- **Team Hub servers** — only local hub configuration and ID maps are backed up
- **Git repository working trees** — collection files in your repo are not inside the backup; only HarborClient sidecar files in user data are included

Secrets encrypted with your operating system keychain may not decrypt when you restore a backup on a different machine or user account. You may need to re-enter API keys, git tokens, or database passwords after restore.

## What's next

- [AI assistant](/ai) — configure API keys and use the chat sidebar
- [Collections](/collections) — organize saved requests and manage storage and backup
- [Environments](/environments) — define global variable groups stored in your chosen backend
- [Features](/features) — overview of storage locations and team collaboration
