# Performance

Follow these rules so plugins stay responsive:

- **Render locally** — Use React state (`useState`, `useEffect`) in the renderer. Do not round-trip to main on every render.
- **IPC for privileges only** — Call `hc.storage`, `hc.fs`, `hc.http`, and similar APIs when you need persistence or host capabilities, not on each keystroke in a loop.
- **Load once, save deliberately** — Read settings when a panel mounts. Debounce text-field writes. Use optimistic UI, then persist in the background.

See [Architecture](/architecture) for how renderer and main entries communicate.
