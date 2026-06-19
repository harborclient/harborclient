![Logo](./images/logo.png)

A desktop HTTP client. Build, send, and inspect HTTP requests with collections, tabs, and local persistence.

## Features

- **Request builder** — Method selector, URL bar, query params, headers, and body (none, JSON, or plain text)
- **HTTP methods** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Response viewer** — Status, timing, size, response body (with JSON pretty-print), and headers
- **Collections** — Organize saved requests into named collections with create, rename, and delete
- **Tabs** — Open multiple requests at once; tab state persists across restarts
- **Local storage** — Collections and requests saved in SQLite (`harbor-client.db` in app user data)
- **Native feel** — macOS hidden inset title bar, system light/dark theme, and platform-aware layout

## Tech stack

| Layer | Stack |
| --- | --- |
| Desktop | Electron 35 |
| UI | React 19, Tailwind CSS 4 |
| Build | electron-vite, TypeScript, Vite 6 |
| Storage | better-sqlite3 |
| HTTP | Node `fetch` in the main process |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

On Linux, development runs with `ELECTRON_DISABLE_SANDBOX=1` because Chrome’s sandbox requires SUID permissions that often fail on mounted or network filesystems.

## Getting started

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the app in development mode with hot reload |
| `pnpm build` | Build main, preload, and renderer for production |
| `pnpm preview` | Run the production build locally |
| `pnpm dist` | Build and package installers (AppImage/deb, DMG, NSIS) |

Packaged artifacts are written to `release/`.

## Project structure

```
src/
├── main/           # Electron main process (window, DB, HTTP, IPC)
├── preload/        # contextBridge API exposed to the renderer
├── renderer/       # React UI
└── shared/         # Shared TypeScript types
```

The renderer talks to the main process through IPC handlers registered in `src/main/ipc.ts`. HTTP requests are executed in the main process (`src/main/http.ts`) so the UI stays responsive and request logic stays out of the renderer sandbox.

## Data

Saved collections and requests live in a SQLite database at:

```
{userData}/harbor-client.db
```

On Linux this is typically `~/.config/harbor-client/`. Deleting a collection removes all requests in it (foreign key cascade).

## License

MIT
