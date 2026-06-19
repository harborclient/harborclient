![Harbor Client](https://headzoo.github.io/harborclient/images/logo-white.png)

**Full documentation:** [https://harborclient.com/](https://harborclient.com/)

**A desktop HTTP client to build, send, and inspect HTTP requests with collections, tabs, and local persistence.**

Harbor Client is a Postman-style HTTP client built with Electron:

- **Request builder** — Method selector, URL bar, query params, headers, and body (none, JSON, or plain text)
- **Collections** — Organize saved requests into named collections with create, rename, and delete
- **Tabs** — Open multiple requests at once; tab state persists across restarts
- **Local storage** — Collections and requests saved in SQLite in app user data

## Documentation

| Topic | Link |
| --- | --- |
| Introduction | [Introduction](https://harborclient.com/) |
| Getting started | [Getting started](https://harborclient.com/getting-started) |
| Features | [Features](https://harborclient.com/features) |
| Project structure | [Project structure](https://harborclient.com/project-structure) |

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run `pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

```bash
pnpm install
pnpm dev
pnpm docs:serve    # VitePress dev server with nav watcher
pnpm docs:build      # production docs build
```

## License

MIT
