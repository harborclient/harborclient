# Solarized theme

This example is a **theme plugin** — a normal HarborClient plugin that contributes `contributes.themes`, registers a palette with `hc.themes.register`, and uses `"categories": ["themes", "dark"]` so the package appears under **File → Themes** and is listed as a dark theme in the marketplace. The user selects **Solarized Dark** from **View → Theme** or **Settings → General → Appearance** alongside the built-in options.

Install and manage theme plugins from **File → Themes** in the app, or browse the [HarborClient theme catalog](https://harborclient.com/themes).

You can ship the same palette with **JavaScript** (`registerTheme`) or with a **JSON import** and no entry bundle. Both are covered below.

## JavaScript registration

### manifest.json

```json
{
  "id": "com.example.solarized",
  "name": "Solarized Theme",
  "version": "1.0.0",
  "categories": ["themes", "dark"],
  "engines": { "harborclient": ">=1.7.0" },
  "renderer": "dist/renderer.js",
  "permissions": ["ui"],
  "contributes": {
    "themes": [{ "id": "solarized", "title": "Solarized Dark", "type": "dark" }]
  }
}
```

### src/renderer.tsx

```tsx
import { type PluginContext, registerTheme } from '@harborclient/sdk';

export function activate(hc: PluginContext): void {
  registerTheme(hc, {
    id: 'solarized',
    title: 'Solarized Dark',
    type: 'dark',
    colors: {
      surface: '#002b36',
      sidebar: '#073642',
      'sidebar-section': '#073642',
      control: '#073642',
      field: 'rgba(255, 255, 255, 0.06)',
      separator: 'rgba(255, 255, 255, 0.1)',
      text: '#839496',
      'text-secondary': '#93a1a1',
      muted: '#657b83',
      accent: '#268bd2',
      selection: 'rgba(38, 139, 210, 0.25)',
      danger: '#dc322f',
      warning: '#cb4b16',
      success: '#859900'
    }
  });
}
```

For themes that need extra rules (custom scrollbars, plugin-specific selectors), ship a CSS file and reference it:

```typescript
registerTheme(hc, {
  id: 'solarized',
  title: 'Solarized Dark',
  type: 'dark',
  colors: {
    /* … */
  },
  stylesheet: 'dist/theme.css'
});
```

Include `dist/theme.css` in your `.hcp` package. The host injects it while the theme is registered and removes it on deactivation.

## JSON import (no JavaScript)

Point the contribution at a Theme Designer export. HarborClient auto-registers the theme when the plugin loads — no `renderer`, `main`, or `activate()` required.

### manifest.json

```json
{
  "id": "com.example.solarized",
  "name": "Solarized Theme",
  "version": "1.0.0",
  "categories": ["themes", "dark"],
  "engines": { "harborclient": ">=1.7.0" },
  "permissions": ["ui"],
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

### exported.json

Export a palette from **File → Themes → Designer**, or write an envelope matching that shape:

```json
{
  "harborclientVersion": 1,
  "harborclientExport": "theme",
  "title": "Solarized Dark",
  "type": "dark",
  "theme": {
    "surface": "#002b36",
    "sidebar": "#073642",
    "sidebar-section": "#073642",
    "control": "#073642",
    "field": "rgba(255, 255, 255, 0.06)",
    "separator": "rgba(255, 255, 255, 0.1)",
    "text": "#839496",
    "text-secondary": "#93a1a1",
    "muted": "#657b83",
    "accent": "#268bd2",
    "selection": "rgba(38, 139, 210, 0.25)",
    "danger": "#dc322f",
    "warning": "#cb4b16",
    "success": "#859900"
  },
  "stylesheet": "styles.css"
}
```

### styles.css (optional)

Ship any extra CSS next to the JSON. On first read, HarborClient inlines the file contents into `exported.json`'s `stylesheet` field so the theme becomes a single self-contained file afterward.

```css
:root[data-theme^='plugin-com.example.solarized-'] {
  /* optional plugin-specific tweaks */
}
```

Packaging for a JSON-only theme: `manifest.json`, `exported.json`, and optionally `styles.css` (plus listing assets). No `dist/` bundle is required.

See [hc.themes](/renderer-data#hc-themes) for the full themes API reference, [JSON theme import](/renderer-data#json-theme-import) for envelope details, and [Theme plugins](/manifest#theme-plugins) for manifest classification.
