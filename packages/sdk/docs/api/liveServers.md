# Live servers

Create, start, stop, and inspect Harbor Live Servers (loopback static file servers with optional CORS, path aliases, and file watching).

Requires the `live-server` permission. This is separate from [`hc.server`](/api/server) (plugin echo server under the `server` permission).

Saved-config `update` / `delete` do **not** restart or stop a running instance. `start` returns the running instance and does **not** open a browser tab — call `hc.livePage(origin)` when you also have the `browser` permission.

```ts
export async function activate(hc: PluginContext): Promise<void> {
  const saved = await hc.liveServers.create({
    name: 'Docs preview',
    root: '/absolute/path/to/site',
    port: null,
    watch: true
  });

  const running = await hc.liveServers.start({ savedId: saved.id });
  console.log(running.origin, running.port);

  const status = await hc.liveServers.getStatus({ savedId: saved.id });
  const logs = await hc.liveServers.getLogs({ savedId: saved.id, limit: 50 });

  hc.liveServers.onRunningChanged((list) => {
    console.log('running count', list.length);
  });
  hc.liveServers.onRequestLog((entry) => {
    console.log(entry.method, entry.url, entry.statusCode);
  });
}
```

<HcMethod name="liveServers.clearLogs" :level="2" />

<HcMethod name="liveServers.create" :level="2" />

<HcMethod name="liveServers.delete" :level="2" />

<HcMethod name="liveServers.get" :level="2" />

<HcMethod name="liveServers.getLogs" :level="2" />

<HcMethod name="liveServers.getStatus" :level="2" />

<HcMethod name="liveServers.list" :level="2" />

<HcMethod name="liveServers.listRunning" :level="2" />

<HcMethod name="liveServers.onRequestLog" :level="2" />

<HcMethod name="liveServers.onRunningChanged" :level="2" />

<HcMethod name="liveServers.start" :level="2" />

<HcMethod name="liveServers.stop" :level="2" />

<HcMethod name="liveServers.update" :level="2" />
