# Package layout

Author source in JS or TS, bundle to `dist/*.js`, then pack the manifest and output files into a `.hcp` file (ZIP format):

```
my-plugin/
├── manifest.json
├── README.md               # or description.md — full Markdown listing (see manifest)
├── assets/
│   ├── icon.png            # plugin icon (referenced by manifest)
│   └── screenshots/        # gallery images for the Plugins or Themes detail modal
│       ├── settings.png
│       └── sidebar.png
├── src/                    # author source (optional, not loaded at runtime)
│   ├── renderer.tsx
│   └── main.ts
└── dist/
    ├── renderer.js         # referenced by manifest "renderer"
    ├── main.js             # referenced by manifest "main" (optional)
    └── theme.css           # optional stylesheet for contributes.themes
```

At runtime HarborClient reads `manifest.json`, the Markdown description, icon, screenshots, and the files referenced under `dist/`.

### Theme-only package (JSON import)

An appearance theme that uses `contributes.themes[].import` can omit `renderer` / `main` and `dist/` entirely:

```
my-theme/
├── manifest.json           # contributes.themes[].import → exported.json
├── exported.json           # harborclientExport: "theme" envelope
├── styles.css              # optional; inlined into exported.json on first read
├── README.md
└── assets/
    └── icon.png
```

See [JSON theme import](/renderer-data#json-theme-import) and [Solarized theme](/examples/solarized-theme#json-import-no-javascript).

See [Manifest](/manifest) for field reference and [Building](/building) for packaging steps.
