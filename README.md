![HarborClient](images/logo.png)

The free API client that keeps your work private: no accounts, no subscriptions, no lock-in. Your work in a safe harbor that you control.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/harborclient/harborclient)](https://github.com/harborclient/harborclient/releases/latest)
[![Documentation](https://img.shields.io/badge/docs-harborclient.com-0366d6)](https://harborclient.com/)
![Electron](https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white)

![HarborClient workspace with collections, request editor, and response panel](images/screenshots/request-response.png)

**Full documentation:** [https://harborclient.com/](https://harborclient.com/)  
**Downloads:** [https://github.com/harborclient/harborclient/releases/latest](https://github.com/harborclient/harborclient/releases/latest)

## Development

```bash
pnpm install
pnpm dev
```

Use `pnpm dev -- -v` for verbose startup and diagnostic logging, or `pnpm dev -- -vv` to also log each outbound HTTP request (method, URL, request headers, and body). Response headers and response bodies are not logged.

Use `pnpm dev -- --seed` to ensure the HarborClient Echo sample collection exists (creates it only when missing).

Use `pnpm dev -- --pick-theme` to open the appearance theme picker on launch (also shown automatically on first install).

Use `pnpm dev -- --quit-without-warning` to quit without prompting when request tabs have unsaved changes.

Use `pnpm dev -- --theme dark` to start with a built-in theme for this session (`light`, `dark`, `system`, or `high-contrast`).

## About HarborClient

**HarborClient** is a free, open-source desktop API client for macOS, Windows, and Linux. It gives you a familiar Postman-style workspace—collections, environments, request scripts, and a tabbed editor—while keeping your work on your machine or on storage you control. There are no accounts, subscriptions, or required cloud sync.

### Who is it for?

- **Individual developers** testing REST and HTTP APIs locally
- **Teams** that want shared collections without per-seat fees or vendor cloud sync—via a shared storage location, [Team Hub](https://github.com/harborclient/team-hub), or git-backed collections
- **Privacy-minded users** who want data on their machine or infrastructure they operate (SQLite by default; optional MySQL, PostgreSQL, or Firestore)
- **Postman and Bruno users** looking to migrate—HarborClient imports Postman v2.1 collection exports and Bruno on-disk collections (see [collections docs](https://harborclient.com/collections#postman-collections))

### Why HarborClient instead of alternatives?

Most API clients tie your collections to a vendor account and a hosted sync service. HarborClient takes a different approach: your requests and environments live where you choose, and the app stays free to use.

- **No lock-in** — pluggable storage backends; export collections as portable JSON
- **You own your data** — local SQLite by default, or connect to a database you run
- **Free forever** — no accounts, subscriptions, or usage limits
- **Real desktop app** — a native Electron app, not a browser tab or hosted SaaS
- **Collaboration on your terms** — share via a common database, git repositories, or a self-hosted Team Hub
- **Familiar workflow** — collections, environments, pre/post scripts, and Postman or Bruno import for a smooth switch

HarborClient does not claim full Postman feature parity; some Postman settings and scripts may need adjustment after import.

### Try it now

1. **Download** the latest release for your OS from [GitHub Releases](https://github.com/harborclient/harborclient/releases/latest)
2. **Install and launch** — no Node.js or build tools required
3. **Send a first request** — paste a URL, pick a method, and click Send
4. **Optional:** import an existing Postman or Bruno collection via **Collections → Import**

For install steps per platform and what to explore next, see the [getting started guide](https://harborclient.com/getting-started).

## Plugin marketplace

Browse curated plugins from **Settings → Plugins → Marketplace** in the app, or on the [plugin marketplace](https://harborclient.com/plugins) site. Each listing installs from a public GitHub repository.

Plugin authors: host your plugin on GitHub, then open a pull request adding an entry to [`plugins/catalog.json`](https://github.com/harborclient/harborclient-site/blob/main/plugins/catalog.json) in the [harborclient-site](https://github.com/harborclient/harborclient-site) repository. See [Publish to the marketplace](https://harborclient.com/plugin_development#publish-to-the-marketplace) in the plugin development guide.

## License

MIT

## Security

Security policy: [SECURITY.md](./SECURITY.md)
