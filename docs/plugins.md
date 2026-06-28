# Plugin marketplace

<PluginCatalog />

Each plugin listing includes an **Install in HarborClient** button that opens the desktop app
via a `harborclient://` link and asks you to confirm before installing from the official
marketplace catalog.

## Custom endpoints

In **Settings → Plugins → Settings**, you can add your own catalog and trusted-publisher
endpoints. HarborClient ships with the official endpoints enabled by default:

- Catalog: `https://harborclient.com/plugin_catalog.json`
- Trusted publishers: `https://harborclient.com/plugins/trusted.json`

You can disable or remove the defaults, add additional endpoints, and use **Reset defaults**
to restore the HarborClient URLs. Enabled endpoints are fetched in list order; when the same
plugin id or signing key appears in more than one source, the first source wins.

Third-party endpoints are supported, but only add catalogs and trusted-key registries from
sources you trust.

## Team Hub sources

Connected [Team Hubs](/team-hubs) can provide additional plugin source URLs through their
`server.yaml` configuration. HarborClient fetches these automatically and shows them in
**Settings → Plugins → Settings** as read-only rows labeled **From {hub name}**. Team Hub
endpoints cannot be removed or disabled in the app; update or remove them on the Team Hub server.

See also:

- [Plugin development](/plugin_development) — build and package plugins
- [Settings → Plugins](/settings#plugins) — install and manage plugins in the app
