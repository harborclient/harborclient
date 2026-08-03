# Manifest

Every plugin requires a manifest at the root of the `.hcp` archive. The example below shows every field; real plugins usually declare only the entries they use.

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",

  "author": "Example Inc.",
  "summary": "Adds a sidebar panel for API audit checks.",
  "description": "README.md",
  "icon": "assets/icon.png",
  "screenshots": [
    {
      "path": "assets/screenshots/settings.png",
      "caption": "Settings panel"
    },
    {
      "path": "assets/screenshots/sidebar.png",
      "caption": "Sidebar tools"
    }
  ],
  "homepage": "https://example.com/my-plugin",
  "bugs": {
    "url": "https://github.com/example/my-plugin/issues"
  },
  "categories": ["editor"],

  "engines": {
    "harborclient": ">=1.7.0"
  },
  "renderer": "dist/renderer.js",
  "main": "dist/main.js",
  "permissions": ["ui", "storage"],

  "contributes": {
    "settingsSections": [{ "id": "myPlugin.settings", "title": "My Plugin" }],
    "sidebarPanels": [
      { "id": "myPlugin.panel", "title": "My Plugin" },
      {
        "id": "myPlugin.collections",
        "title": "My Collections",
        "replaces": "collections"
      }
    ],
    "sidebarRailItems": [{ "id": "myPlugin.tools", "title": "My Tools", "icon": "bolt" }],
    "sidebarSections": [{ "id": "myPlugin.section", "title": "My Plugin" }],
    "mainViews": [{ "id": "myPlugin.view", "title": "My Plugin" }],
    "requestTabs": [{ "id": "myPlugin.requestTab", "title": "Audit" }],
    "responseTabs": [{ "id": "myPlugin.responseTab", "title": "Summary" }],
    "collectionSettingsTabs": [{ "id": "myPlugin.collTab", "title": "Plugin" }],
    "footerPanels": [{ "id": "myPlugin.footer", "title": "My Plugin" }],
    "requestToolbarActions": [{ "id": "myPlugin.sendAction", "title": "Run check" }],
    "livePageChromeActions": [{ "id": "myPlugin.pageAction", "title": "Page action" }],
    "workflowToolbarActions": [{ "id": "myPlugin.annotate", "title": "Annotate" }],
    "workflowActionBlocks": [{ "id": "badge", "title": "Action badge" }],
    "scriptEditorActions": [{ "id": "myPlugin.convert", "title": "Convert" }],
    "contextMenus": [{ "id": "myPlugin.requestMenu", "title": "Plugin action" }],
    "statusBarItems": [{ "id": "myPlugin.status", "title": "Status" }],
    "themes": [{ "id": "solarized", "title": "Solarized Dark", "type": "dark" }],
    "commands": [{ "id": "myPlugin.run", "title": "Run plugin command" }],
    "menus": [
      {
        "menu": "view",
        "command": "myPlugin.run",
        "group": "plugin"
      }
    ]
  }
}
```

| Field                  | Required | Description                                                                                                                                                                                                                                                                  |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | Yes      | Reverse-DNS identifier. Namespaces storage and plugin updates.                                                                                                                                                                                                               |
| `name`                 | Yes      | Display name shown in Settings and install dialogs.                                                                                                                                                                                                                          |
| `version`              | Yes      | Semver version string.                                                                                                                                                                                                                                                       |
| `author`               | No       | Publisher or author name shown on the plugin detail page.                                                                                                                                                                                                                    |
| `summary`              | No       | Short one-line description shown in marketplace lists and the plugin detail view.                                                                                                                                                                                            |
| `description`          | No       | Path to a Markdown file (for example `README.md`) with the full plugin description. Rendered in the plugin detail modal on **File → Plugins** or **File → Themes**.                                                                                                          |
| `icon`                 | No       | Path to a square PNG or SVG icon (recommended 128×128 px or larger). Shown in the plugin list and install dialog.                                                                                                                                                            |
| `screenshots`          | No       | Gallery images for the plugin detail page. See [Screenshots](#screenshots) below.                                                                                                                                                                                            |
| `homepage`             | No       | URL to the plugin's website or documentation. Shown as a link on the detail page.                                                                                                                                                                                            |
| `bugs`                 | No       | Issue tracker for bug reports. Use `{ "url": "https://…" }`. Shown as **Report issue** on the detail page.                                                                                                                                                                   |
| `categories`           | No       | Marketplace category slugs (for example `themes`, `editor`, `dark`). Include `themes` for appearance-only packages listed under **File → Themes**. Theme packages should also include one appearance slug — `light`, `dark`, or `high-contrast` — for marketplace filtering. |
| `engines.harborclient` | Yes      | Minimum HarborClient version (for example `>=1.7.0`).                                                                                                                                                                                                                        |
| `renderer`             | No       | Path to the renderer entry bundle (UI). A plugin must declare at least one of `renderer`, `main`, or a `contributes.themes` entry with `import`.                                                                                                                             |
| `main`                 | No       | Path to the main entry bundle (hooks, IPC, logic). See `renderer` for the entry-or-import requirement.                                                                                                                                                                       |
| `permissions`          | Yes      | Capabilities the plugin needs. Summarized in the install confirmation dialog.                                                                                                                                                                                                |
| `contributes`          | No       | Declarative UI slots listed before plugin code activates.                                                                                                                                                                                                                    |

## Plugin metadata

Listing metadata is separate from `contributes` — it describes the package for users browsing **File → Plugins** or **File → Themes**, not UI slots inside the app.

### summary

A plain one-line tagline for marketplace cards and the plugin detail header. Keep it under roughly one sentence — for example, what the plugin does at a glance. This is separate from `description`, which points to a Markdown file with full install-time documentation.

```json
"summary": "Adds a sidebar panel for API audit checks."
```

### description

Points to a Markdown file at the plugin package root (relative path only; no absolute paths or URLs). HarborClient renders the file in the plugin detail view with the same Markdown subset used elsewhere in the app (headings, lists, links, code fences, emphasis).

Use this for install-time documentation: features, setup notes, permission rationale, and changelog highlights. Keep `manifest.json` lean; put prose in `README.md` or `description.md`.

```markdown
# My Plugin

Logs every outbound HTTP request to the terminal and adds a **Solarized Dark** theme.

## Permissions

- `http` — before/after send hooks for request logging
- `ui` — theme registration
- `mcp` — register a remote MCP client server for Harbor's chat agent
```

### icon

Path to a PNG or SVG under the plugin directory. Recommended **128×128 px** minimum; HarborClient scales down for list rows and up for the detail header. Use a transparent background for PNG icons.

### Screenshots

An array of screenshot entries. Each entry is either:

- a **string** — plugin-relative image path, or
- an **object** — `{ "path": "assets/…", "caption": "Optional label" }`

Supported formats: PNG, JPEG, WebP. Recommended width **1280 px** or wider; HarborClient scales images to fit the detail gallery. Include two to five screenshots that show primary UI contributions.

```json
"screenshots": [
  "assets/screenshots/overview.png",
  { "path": "assets/screenshots/settings.png", "caption": "Plugin settings" }
]
```

### author, homepage, and bugs

| Field      | Example                                         | Shown in UI                   |
| ---------- | ----------------------------------------------- | ----------------------------- |
| `author`   | `"Acme HTTP Tools"`                             | Publisher line on detail page |
| `homepage` | `"https://example.com/my-plugin"`               | **Website** link              |
| `bugs.url` | `"https://github.com/example/my-plugin/issues"` | **Report issue** link         |

All URL fields must use `https://` (or `http://` for local development documentation only). HarborClient opens links in the system default browser.

## Permissions

Declare required capabilities in the `permissions` array. HarborClient summarizes them in the install confirmation dialog. See [Permissions](/permissions) for the full table.

Common renderer permissions:

| Permission       | Use when your plugin needs to…                                                          |
| ---------------- | --------------------------------------------------------------------------------------- |
| `ui`             | Register settings, themes, commands, import handlers, or other UI contributions         |
| `mcp`            | Register remote MCP client servers with `hc.mcp.registerServer` for Harbor's chat agent |
| `ai`             | Register `@plugin…` chat pointers and copy context into the AI sidebar with `hc.ai`     |
| `browser`        | Open and control embedded browser tabs via `hc.livePage`                                |
| `live-server`    | Create, start, stop, and inspect Harbor Live Servers via `hc.liveServers`               |
| `live-pages`     | Create, update, and delete saved Live Pages via `hc.livePages`                          |
| `storage`        | Persist plugin-scoped key-value data with `hc.storage`                                  |
| `http`           | HTTP request hooks in the main process (`onBeforeSend` / `onAfterSend`)                 |
| `scripts:inject` | Inject and observe pre/post request scripts (`onBeforeScripts` / `onAfterScripts`)      |
| `network`        | Send outbound HTTP from the renderer via `hc.host.fetch`                                |

Example permission rationale in a plugin `description` Markdown file:

```markdown
# My Plugin

Connects Harbor's chat agent to a remote WordPress MCP endpoint.

## Permissions

- `mcp` — register the WordPress MCP client server at activation
```

## Theme plugins

Appearance themes are **plugins** — the same `.hcp` packaging, install flow, and permission model as any other extension. A theme plugin:

1. Declares one or more slots in `contributes.themes`
2. Supplies the palette either by registering at activation with `hc.themes.register` (or `registerTheme`) **or** by pointing the contribution at a Theme Designer export with `"import": "exported.json"` (see [JSON theme import](/renderer-data#json-theme-import))
3. Includes `"categories": ["themes", …]` so HarborClient lists the package on **File → Themes** instead of **File → Plugins**. Add one appearance slug — `light`, `dark`, or `high-contrast` — alongside `themes` so users can filter the theme marketplace (for example `"categories": ["themes", "dark"]`).

Appearance categories are marketplace metadata only. `contributes.themes[].type` (`light`, `dark`, or `high-contrast`) remains the runtime hint HarborClient uses when registering theme palettes. When using `import`, manifest `id` / `title` / `type` stay authoritative; the JSON file supplies `colors` and an optional stylesheet.

**JavaScript themes** need a `renderer` entry and typically only the `ui` permission. **JSON import themes** can ship as a theme-only package with no `renderer` or `main` — `manifest.json` plus the export file (and optional sibling CSS before first-read inlining). They still declare `permissions: ["ui"]`.

Users activate a registered theme from **View → Theme** or **Settings → General → Appearance**.

If your plugin also contributes UI panels, tabs, or hooks alongside a theme, omit the `themes` category so the package stays on the **Plugins** page. Mixed plugins can still register themes; they simply are not classified as theme-only listings.

For a complete walkthrough, see [Solarized theme](/examples/solarized-theme).

## Contribution types

The `contributes` block declares where your plugin can appear. Each entry's `id` must match the `id` passed to the corresponding `hc.ui.register*` (or `hc.themes.register`) call at activation time — **except** theme entries with an `import` field, which HarborClient auto-registers from the JSON file without JavaScript.

| Manifest key             | `hc.ui` registrar                | UI surface                                                                                             |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `settingsSections`       | `registerSettingsSection`        | Settings sidebar and panel                                                                             |
| `sidebarPanels`          | `registerSidebarPanel`           | Switchable left sidebar destination, or primary Collections replacement when `replaces: "collections"` |
| `sidebarRailItems`       | `registerSidebarRailItem`        | Activity-rail icon that opens a full sidebar body while keeping the rail visible                       |
| `sidebarSections`        | `registerSidebarSection`         | Collapsible block inside the scrollable sidebar                                                        |
| `mainViews`              | `registerMainView`               | Full main-area overlay (Team Hubs pattern)                                                             |
| `modals`                 | `registerModal`                  | Application-root modal overlay                                                                         |
| `requestTabs`            | `registerRequestTab`             | Request editor segmented tabs                                                                          |
| `responseTabs`           | `registerResponseTab`            | Response viewer tabs                                                                                   |
| `collectionSettingsTabs` | `registerCollectionSettingsTab`  | Collection settings segmented tabs                                                                     |
| `footerPanels`           | `registerFooterPanel`            | Slide-up footer panel                                                                                  |
| `requestToolbarActions`  | `registerRequestToolbarAction`   | Button near Send in the URL bar                                                                        |
| `livePageChromeActions`  | `registerLivePageChromeAction`   | RoundButton in browser chrome between Downloads and Ask AI (activation-order sorted)                   |
| `scriptEditorActions`    | `registerScriptEditorAction`     | Icon button on each pre/post script editor row                                                         |
| `workflowToolbarActions` | `registerWorkflowToolbarAction`  | Button to the right of Save in the workflow play/edit toolbar                                          |
| `workflowActionBlocks`   | `registerWorkflowActionBlock`    | HostedSurface inside matching workflow timeline action blocks                                          |
| `contextMenus`           | `registerContextMenuItem`        | Row actions on sidebar collections, folders, requests                                                  |
| `statusBarItems`         | `registerStatusBarItem`          | Footer status area (beside sidebar / AI toggles)                                                       |
| `themes`                 | `hc.themes.register` or `import` | Appearance theme in **View → Theme** and **Settings → General → Appearance**                           |
| `commands`               | `hc.commands.register`           | Command handlers (menus, toolbar, context menus)                                                       |
| `menus`                  | `registerMenuItem`               | File, Edit, View, or Help application menu                                                             |

Settings sections ship in the initial plugin release. Other contribution types are part of the target API documented in the [Renderer API](/renderer-overview) and will roll out in subsequent HarborClient versions. Declare them in the manifest now so install dialogs and future host versions can discover slots before your code loads.

### Replacing the Collections sidebar

A `sidebarPanels` entry may include optional `replaces: "collections"`. That field is **manifest-only** — do not pass it to `hc.ui.registerSidebarPanel`. When the panel is registered and enabled:

- The host treats it as the **primary collections surface** (Redux `activeSidebarPanelId === null` mounts this panel instead of the built-in Collections tree).
- The panel switcher hides the built-in "Collections" tab and uses the replacement panel's `title` as the primary tab when other non-replacing panels exist.
- If only the replacement panel is registered, the switcher is hidden entirely.

**Conflict rule:** If more than one registered panel declares `replaces: "collections"`, the host picks a single winner: lowest `order` (default `100`), then lowest `pluginId`, then lowest contribution `id`. A warning is logged for the ignored candidates.

See [hc.ui.registerSidebarPanel](/renderer-ui#hcuiregistersidebarpanelpanel) for runtime registration.

### Activity-rail sidebar destinations

A `sidebarRailItems` entry adds an icon to the vertical activity rail (alongside Collections, Environments, and so on). Selecting it opens the plugin's sidebar body in a HostedSurface while **keeping the rail visible**. This is distinct from `sidebarPanels`, which use a horizontal switcher and hide the rail.

Declare `icon` on the manifest entry (curated names such as `bolt`, `server`, `flask`). Runtime registration requires the same `icon` on `hc.ui.registerSidebarRailItem`.

See [hc.ui.registerSidebarRailItem](/renderer-ui#hcuiregistersidebarrailitemitem) for runtime registration.

See [UI contributions](/renderer-ui) for registration method reference.
