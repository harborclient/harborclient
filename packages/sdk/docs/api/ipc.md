# IPC

Renderer ↔ main RPC for the plugin. Requires the `ipc` permission.

## Renderer

Call `hc.ipc.invoke(channel, ...args)` instead of `window.api.invokePluginMain`.

## Main entry

Use `hc.ipc.handle` in the main entry to serve channels that the renderer calls with `hc.ipc.invoke`.

<HcMethod name="ipc.handle" :level="2" />

<HcMethod name="ipc.invoke" :level="2" />
