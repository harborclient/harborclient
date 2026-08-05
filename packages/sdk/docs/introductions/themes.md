Theme packages are plugins. Ship the same `.hcp` layout, require the `ui` permission, declare slots in `contributes.themes`, and set `"categories": ["themes"]` when the package should appear under **File → Themes**. Users pick an active theme from **View → Theme** or **Settings → General → Appearance**.

See [Theme plugins](/manifest#theme-plugins) for manifest fields and [Marketplace → Theme listings](/marketplace#theme-listings) for catalog publishing.

Custom appearance themes extend the built-in **Light**, **Dark**, **System**, and **High contrast** options in **Settings → General**. Plugin themes appear in the same dropdown once registered.

HarborClient styles the app with `--mac-*` CSS custom properties defined in `src/renderer/src/styles.css`. When a plugin theme is active, the host sets `data-theme="plugin-<pluginId>-<themeId>"` on `<html>` and applies your token overrides or injected stylesheet. Built-in light/dark/system behavior is unchanged when a builtin theme is selected.

Themes can be registered two ways:

1. **JavaScript** — call `registerTheme(hc, theme)` or `hc.themes.register(theme)` from `activate()`.
2. **JSON import** — point the manifest contribution at a Theme Designer export file (see [JSON theme import](#json-theme-import)). No `activate()` call is required for those entries.

Requires the `ui` permission. For JavaScript registration, call `registerTheme(hc, theme)` or `hc.themes.register(theme)` from `activate()` — registration disposables are tracked automatically.

### JSON theme import

Declare an `import` path on the contribution to ship a palette without JavaScript:

```json
{
  "contributes": {
    "themes": [
      {
        "id": "solarized",
        "title": "Solarized Dark",
        "type": "dark",
        "import": "exported.json"
      }
    ]
  }
}
```

The file must be a `harborclientExport: "theme"` envelope — the same shape as **File → Themes → Designer** export:

```json
{
  "harborclientVersion": 1,
  "harborclientExport": "theme",
  "title": "Solarized Dark",
  "type": "dark",
  "theme": {
    "surface": "#002b36",
    "accent": "#268bd2"
  },
  "stylesheet": "styles.css"
}
```

| Field                 | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `harborclientVersion` | Always `1`                                                                   |
| `harborclientExport`  | Always `"theme"`                                                             |
| `theme`               | Token overrides without the `--mac-` prefix                                  |
| `title` / `type`      | Present in the export; manifest `id` / `title` / `type` remain authoritative |
| `stylesheet`          | Optional plugin-relative CSS filename, or inlined CSS after first read       |

On first read, if `stylesheet` points at an existing CSS file inside the plugin directory, HarborClient inlines the CSS text into the JSON on disk. Later reads treat the value as already-inlined CSS (idempotent). Theme-only packages can omit `renderer` and `main` entirely.

See the [Solarized theme](/examples/solarized-theme#json-import-no-javascript) example and [Theme plugins](/manifest#theme-plugins).

### registerTheme(hc, theme)

**Signature:** `(hc: PluginContext, theme: ThemeContribution) => Disposable`

Convenience wrapper around `hc.themes.register`. Prefer this for single-theme plugins.

```typescript
import { registerTheme } from '@harborclient/sdk';

registerTheme(hc, {
  id: 'solarized',
  title: 'Solarized Dark',
  type: 'dark',
  colors: { surface: '#002b36' }
});
```

Use `defineTheme(theme)` when you want to define the theme object in a separate module with full `ThemeContribution` typing.

### Theme color tokens

Override any of these keys in `colors`. Each maps to `--mac-<token>` on the document root.

| Token                                                  | Used for                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `surface`                                              | Main content background                                     |
| `header`                                               | Top header strip (sidebar search + request tab bar)         |
| `page-header`                                          | Page title header background (`PageHeader`)                 |
| `page-header-text`                                     | Page title header primary text                              |
| `page-header-muted`                                    | Page title header description and decorative icons          |
| `sidebar`                                              | Left sidebar background                                     |
| `sidebar-toolbar`                                      | Sidebar/footer toolbar strip background                     |
| `sidebar-rail`                                         | Activity rail background                                    |
| `sidebar-rail-active`                                  | Active/hover activity rail section fill                     |
| `sidebar-rail-text`                                    | Activity rail icons and labels                              |
| `sidebar-rail-separator`                               | Activity rail hairline between item groups                  |
| `sidebar-section`                                      | Sidebar section headers                                     |
| `sidebar-section-text`                                 | Sidebar section header labels and chevrons                  |
| `footer`                                               | Footer status bar background                                |
| `footer-text`                                          | Footer primary text                                         |
| `footer-muted`                                         | Footer de-emphasized text                                   |
| `footer-icon-active`                                   | Active footer icon toggle color                             |
| `toolbar-action-active`                                | Pressed sidebar toolbar action icon color                   |
| `breadcrumb-background`                                | Request editor breadcrumb bar track                         |
| `breadcrumb-segment`                                   | Breadcrumb chevron segment fill                             |
| `git-staged`                                           | Git-backed request names staged for commit                  |
| `git-uncommitted`                                      | Git-backed request names with tracked unstaged changes      |
| `git-unstaged`                                         | Git-backed request names not yet added to the repository    |
| `control`                                              | Panels, inputs, footer bar                                  |
| `field`                                                | Input field fill                                            |
| `separator`                                            | Borders and dividers                                        |
| `text`                                                 | Primary text                                                |
| `text-secondary`                                       | Secondary labels                                            |
| `muted`                                                | De-emphasized text                                          |
| `accent`                                               | Links, focus rings, primary actions                         |
| `selection`                                            | Selected row / highlight fill                               |
| `tab-bar`                                              | Request editor tab bar strip background                     |
| `tab-active`                                           | Active request/editor tab fill                              |
| `tab-inactive`                                         | Inactive request/editor tab fill                            |
| `tab-hover`                                            | Inactive request/editor tab hover and focus-visible fill    |
| `tab-text`                                             | Active (and hover/focus) request/editor tab label color     |
| `tab-text-inactive`                                    | Inactive request/editor tab label color                     |
| `tab-unsaved`                                          | Request/markdown tab title when the tab has unsaved changes |
| `tab-underline`                                        | Active request tab underline                                |
| `resize-separator`                                     | Resizable panel separator track and edge border             |
| `resize-handle`                                        | Resizable panel grip (and high-contrast chrome accents)     |
| `variable-token`                                       | `{{variable}}` syntax highlight in editors                  |
| `danger`, `danger-light`, `warning`, `success`, `info` | Status colors                                               |
| `method-get`, `method-post`, …                         | HTTP method badge colors                                    |

See the [Solarized theme example](/examples/solarized-theme) for a complete theme plugin.
