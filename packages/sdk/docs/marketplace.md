# Marketplace

HarborClient maintains a curated [plugin marketplace](https://harborclient.com/plugins) built from [`plugins/catalog.json`](https://github.com/harborclient/harborclient/blob/main/plugins/catalog.json) in the main repository. In the app, open **File → Plugins → Marketplace** to install listed plugins with one click. The app clones each listing from its public GitHub repository using the same git install flow as **Install from Git…**.

## Requirements

1. **Host on GitHub** — Publish your plugin source in a public `https://github.com/...` repository. The repository root must contain a valid `manifest.json` and prebuilt entry files (HarborClient does not run a build step during install).
2. **Match manifest metadata** — The catalog `id` must match your plugin manifest `id`. Keep `name`, `version`, and `engines.harborclient` accurate in the repository.
3. **Open a pull request** — Add an entry to [`plugins/catalog.json`](https://github.com/harborclient/harborclient/blob/main/plugins/catalog.json) in the HarborClient repository.

## Catalog entry fields

| Field           | Required | Description                                                                               |
| --------------- | -------- | ----------------------------------------------------------------------------------------- |
| `id`            | Yes      | Plugin manifest id (for example `com.example.my-plugin`).                                 |
| `name`          | Yes      | Display name shown in the marketplace.                                                    |
| `version`       | Yes      | Semver version string (must match the tagged release in `ref` when set).                  |
| `summary`       | Yes      | Short one-line description for list views.                                                |
| `author`        | Yes      | Publisher or author name.                                                                 |
| `categories`    | Yes      | One or more category labels (for example `themes`, `integrations`).                       |
| `repoUrl`       | Yes      | Public GitHub repository URL (`https://github.com/owner/repo`).                           |
| `ref`           | No       | Branch or tag to clone (for example `v1.0.0`). Omit to use the repository default branch. |
| `homepage`      | No       | Project website URL.                                                                      |
| `icon`          | No       | HTTPS URL to a square plugin icon.                                                        |
| `screenshot`    | No       | HTTPS URL to a preview image shown in the marketplace list (PNG, JPEG, or WebP).          |
| `minAppVersion` | No       | Minimum HarborClient semver required to install.                                          |

Example plugin entry:

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "summary": "Adds a sidebar panel for API audit checks.",
  "author": "Example Inc.",
  "categories": ["integrations"],
  "repoUrl": "https://github.com/example/my-plugin",
  "ref": "v1.0.0",
  "homepage": "https://example.com/my-plugin",
  "screenshot": "https://raw.githubusercontent.com/example/my-plugin/v1.0.0/assets/screenshots/overview.png"
}
```

## Theme listings

Theme packages are plugins that contribute `contributes.themes`. List them in the same [`plugins/catalog.json`](https://github.com/harborclient/harborclient/blob/main/plugins/catalog.json) file with `"categories": ["themes"]`. Theme-only repositories should also include `"categories": ["themes", …]` in `manifest.json` — add one appearance slug (`light`, `dark`, or `high-contrast`) alongside `themes` so HarborClient routes the installed package to **File → Themes** and users can filter the marketplace by appearance.

In the app, users install theme listings from **File → Themes → Marketplace**. The web catalog for themes lives at [harborclient.com/themes](https://harborclient.com/themes).

Example theme entry:

```json
{
  "id": "com.example.solarized",
  "name": "Solarized Theme",
  "version": "1.0.0",
  "summary": "Solarized Dark appearance theme for HarborClient.",
  "author": "Example Inc.",
  "categories": ["themes", "dark"],
  "repoUrl": "https://github.com/example/solarized-theme",
  "ref": "v1.0.0",
  "screenshot": "https://raw.githubusercontent.com/example/solarized-theme/v1.0.0/assets/screenshots/overview.png"
}
```

After your pull request merges, the docs site and in-app catalog update on the next HarborClient docs deploy. You do not need to host the catalog yourself — only your plugin repository on GitHub.
