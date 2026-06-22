# Team hubs

Team hubs connect HarborClient to a running **[HarborClient Team Hub](https://github.com/headzoo/harborclient-service-hub)** instance — a self-hosted central server that stores shared collections for your team. Each hub is a named connection with a base URL and bearer API token. Collections you store on a hub live on the team hub; HarborClient syncs them into the sidebar and routes create, read, update, and delete operations through its HTTP API.

**Environments are not shared via team hubs.** Environment variable groups stay in your local registry on each machine, even though HarborClient Team Hub supports environments on the server. Use [Environments](/environments) for per-machine variable groups; use team hubs when you want teammates to share the same collection data.

```mermaid
flowchart LR
  App[HarborClient] --> HubConn[Team hub connection]
  HubConn --> TeamHubServer[HarborClient Team Hub]
  TeamHubServer --> Collections[Shared collections]
  App --> LocalRegistry[Local registry and environments]
```

## Prerequisites

Before adding a team hub in HarborClient, you need:

| Requirement | Description |
| --- | --- |
| **HarborClient Team Hub** | A running team hub instance your team can reach over the network. See the [HarborClient Team Hub repository](https://github.com/headzoo/harborclient-service-hub) and [full documentation](https://headzoo.github.io/harborclient-service-hub/) for setup and deployment. |
| **Team hub URL** | The team hub base URL (for example `http://127.0.0.1:8788` or `https://api.example.com`). HarborClient strips trailing slashes when saving. |
| **API token** | A bearer token prefixed with `hbk_` that authorizes your HarborClient instance against protected API routes. Obtain or create tokens according to your team hub's documentation. |

HarborClient verifies connectivity when a hub is saved or mounted at launch. If the team hub is unreachable or the token is invalid, the hub is skipped and a warning is logged — other providers continue to work.

## Managing team hubs

Open **File → Team Hubs** to manage hub connections. The page lists every configured hub with its display name and URL.

### Add a team hub

| Step | Action |
| --- | --- |
| 1 | Click **Add team hub** |
| 2 | Enter a **Name** (shown in provider dropdowns and sidebar badges) |
| 3 | Enter the **Team hub URL** |
| 4 | Enter the **API token** |
| 5 | Click **Save** |

On success, HarborClient shows **Team hub saved.**, mounts the hub, and runs an additive sync so collections already on the team hub appear in the sidebar.

### Edit a team hub

Click **Edit** on a hub row, change any field, and click **Save**. HarborClient remounts the hub with the updated URL or token and syncs collections again.

### Delete a team hub

Click **Delete** on a hub row and confirm. Deleting a hub:

- Removes the hub connection from HarborClient
- Removes sidebar registry entries for collections that belonged to that hub
- Deletes the local id-map file HarborClient used to translate server UUIDs to numeric ids

Deleting a hub does **not** delete collections on HarborClient Team Hub itself — teammates who still have access can continue to use server-side data. Your local sidebar entries for that hub are removed.

## Collections on a team hub

HarborClient treats database connections and team hubs as **providers** — places where collection data can live.

### Choosing a provider

When you create or move a collection, pick the provider that should store its data:

| Location | How |
| --- | --- |
| **Create new collection** | Sidebar **+** or **File → New Collection** → **Add collection** → **Create new** → choose **Provider** |
| **Move an existing collection** | **Collection Settings → General → Provider** → **Save** |

The provider dropdown lists SQLite, Firestore, MySQL, PostgreSQL, and any configured team hubs. Team hubs are labeled **(Team Hub)**.

The **active database** (set in [Settings → Databases](/settings#databases)) is the default provider for new collections when you do not choose another one.

### Auto-sync

HarborClient syncs collections from each reachable hub:

- **On app launch** — after hubs are mounted, new team hub collections are added to the sidebar
- **When you save a hub** — immediately after add or edit

Sync is **additive**: collections on the team hub that are not yet in your sidebar are registered automatically. HarborClient does **not** remove sidebar entries when a collection is temporarily missing (for example, while the team hub is offline). You may see a warning instead.

There is **no background polling** or live sync. Changes made by teammates appear when HarborClient reloads data — for example, after restarting the app or when a hub is saved again.

### Sidebar badges

When a collection's provider is not your active database, its row shows a connection badge with the provider name (database or team hub). This helps distinguish local collections from hub-backed or shared remote-database collections.

## Moving and deleting collections

### Move a collection off a hub

In **Collection Settings → General**, change **Provider** to a database (or another hub) and click **Save**. HarborClient copies the collection's folders and requests to the target provider and updates the sidebar entry.

When the source is a team hub, HarborClient **leaves the original collection on HarborClient Team Hub**. Teammates keep access to the server copy. HarborClient records the collection as **detached** from that hub so a later sync does not re-add it to your sidebar.

When the source is a local or remote **database**, HarborClient deletes the source copy after a successful move, as before.

### Move a collection onto a hub

Choose a team hub as the target **Provider** and save. HarborClient creates the collection on the team hub via the API and removes the source copy from the previous database provider (standard move behavior).

### Delete a hub-backed collection

Choose **Delete** from the collection row menu. When the collection is stored on a team hub, HarborClient asks you to confirm that **team members will lose access** to the collection on the team hub. Confirming deletes the collection on HarborClient Team Hub and removes it from your sidebar.

Deleting a collection from a SQLite or remote-database provider does not show this team-access warning — only hub-backed collections affect shared server data.

## Team hubs vs other sharing options

HarborClient offers several ways to work with others. Pick the approach that matches how your team operates:

| Approach | Best for |
| --- | --- |
| **SQLite / local DB** | Solo work, offline-first, full control on one machine |
| **Remote DB** (Firestore, MySQL, Postgres) | Team shares one database directly; configure connections in [Settings → Databases](/settings#databases) |
| **Encrypted invites** | One-step handoff of database credentials plus a collection; requires [Certificates](/certificates) and [Collections → Sharing](/collections#sharing-collections) |
| **Team hubs** | Team shares collections through HarborClient Team Hub with token-based access — no manual database setup per teammate |

**Remote database vs team hub:** With a remote database, every teammate configures the same DB connection (or accepts an invite that embeds credentials). With a team hub, teammates only need the team hub URL and their own API token; collection data is exposed through HarborClient Team Hub's HTTP API.

**Invites vs team hubs:** Invites bundle remote **database** connection details and a single collection mapping. Team hubs are a separate path: collections live on HarborClient Team Hub, and sync discovers collections your token can access. The **Invite** row menu action is intended for remote-database sharing; for hub-backed collections, sharing is handled by granting team hub access (tokens) rather than sending an invite token.

## Limitations

| Topic | Behavior |
| --- | --- |
| **Live sync** | No background polling. Reload data by restarting the app or saving a hub again. |
| **Environments** | Not shared via hubs. Each HarborClient instance keeps its own environment list locally. |
| **Concurrent edits** | Last write wins through the team hub API. HarborClient does not merge conflicting edits. |
| **Offline team hub** | Hub-backed collections may show warnings if the team hub is unreachable; sidebar entries are not auto-deleted. |
| **Configuration location** | Team hubs are managed under **File → Team Hubs**, not under [Settings → Databases](/settings#databases). |

## What's next

- [Collections](/collections) — sidebar, settings, import/export, and provider moves
- [Settings → Databases](/settings#databases) — SQLite and remote database connections
- [Certificates](/certificates) — keys and trusted collaborators for encrypted invites
- [Environments](/environments) — local variable groups that override collection variables at send time
- [HarborClient Team Hub documentation](https://headzoo.github.io/harborclient-service-hub/) — install, configure, and run the central server
