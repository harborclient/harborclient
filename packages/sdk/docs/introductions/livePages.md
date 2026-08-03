Create, update, and delete saved Live Pages (website registry rows with URL, home URL, injection scripts, pre/post request scripts, variables, headers, and auth).

Requires the `live-pages` permission. This is separate from [`hc.livePage`](/api/livePage) (embedded browser tab control under the `browser` permission) and from [`hc.liveServers`](/api/liveServers).

Registry mutations do **not** open or bind a browser tab.

```ts
export async function activate(hc: PluginContext): Promise<void> {
  const page = await hc.livePages.create({
    name: 'Docs',
    url: 'https://example.com/docs',
    homeUrl: 'https://example.com/',
    scripts: [],
    preRequestScripts: [],
    postRequestScripts: []
  });

  const listed = await hc.livePages.list();
  const found = await hc.livePages.get(page.uuid);
  await hc.livePages.update({
    ...page,
    name: 'Docs (updated)'
  });
  await hc.livePages.delete(page.id);
  console.log(listed.length, found?.name);
}
```
