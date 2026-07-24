# Types and IPC contract

Domain types live under [`src/types/`](https://github.com/harborclient/harborclient/tree/main/packages/core/src/types/). The renderer IPC surface is defined in `src/types/api/` and re-exported for deep imports via `@harborclient/core/types`.

When changing an IPC method in the HarborClient GUI, keep these three layers in sync (see [CONTRIBUTING.md](https://github.com/harborclient/harborclient/blob/main/CONTRIBUTING.md)):

1. **`packages/core/src/types/`** — domain types and `Api` contract
2. **`apps/gui/src/preload/index.ts`** — `ipcRenderer.invoke` wrappers
3. **`apps/gui/src/main/ipc/index.ts`** — `ipcMain.handle` handlers

Channel names follow `resource:action` (for example `collections:list`, `http:send`).
