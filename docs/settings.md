# Settings

HarborClient application settings control appearance, HTTP request defaults, and the database connections where collections, requests, and environments are stored. Open settings from **File → Settings** or **Cmd/Ctrl+,**.

The settings panel has a sidebar with two sections: **General** and **Databases**. General covers appearance and request defaults; Databases manages the named database connections that hold your data.

Appearance, request defaults, and connection definitions are stored in electron-store on your machine. Collections, requests, and environments live in the database connections you configure.

## General

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

## Databases

The **Databases** section lists every named database connection. The **active** database is used for new collections and imports. Individual collections can be moved to other databases from collection settings.

All configured databases are opened at launch, so shared collections from any connection are available immediately.

### Managing connections

| Action | Description |
| --- | --- |
| **Add database** | Create a new connection. Choose a name and type, then configure its connection details. |
| **Set active** | Mark a connection as the active database for new data. |
| **Edit** | Change a connection's name and connection details. The type cannot be changed after creation. |
| **Delete** | Remove a connection. The last remaining connection cannot be deleted, and the last remaining SQLite connection cannot be deleted. Deleting the active database promotes another connection to active after restart. |

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
| **Database** | MySQL database name | (empty) |

#### PostgreSQL

Stores data on a remote PostgreSQL server. Use this type for self-hosted or team-shared storage.

| Field | Description | Default |
| --- | --- | --- |
| **Host** | PostgreSQL server hostname | `127.0.0.1` |
| **Port** | PostgreSQL server port | `5432` |
| **User** | PostgreSQL username | (empty) |
| **Password** | PostgreSQL password | (empty) |
| **Database** | PostgreSQL database name | (empty) |

When you use a remote type such as Firestore, MySQL, or PostgreSQL, multiple HarborClient instances can point at the same database to share collections, environments, and saved requests across your team. Changes from other users appear when you reload data (for example, after restarting the app or refreshing collections); HarborClient does not live-sync in the background.

## What's next

- [Collections](/collections) — organize saved requests and manage storage and backup
- [Environments](/environments) — define global variable groups stored in your chosen backend
- [Features](/features) — overview of database backends and team collaboration
