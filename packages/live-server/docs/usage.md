# Usage

Start a live server by passing a config and host-injected providers:

```ts
import {
  startLiveServer,
  stopLiveServer,
  type LiveServerHostProviders
} from '@harborclient/live-server';

const providers: LiveServerHostProviders = {
  listSnippets: () => [],
  getVariables: () => ({}),
  runScript: async (_input) => {
    // SES sandbox (GUI) or NodeScriptRunner (CLI)
    throw new Error('Wire a ScriptRunResult-producing runner');
  }
};

const running = await startLiveServer(
  {
    config: {
      name: 'Demo',
      root: '/absolute/path/to/site',
      port: null, // auto-select from 5500 upward
      aliases: [],
      watch: true,
      // ...other LiveServerConfig fields from @harborclient/core
    }
  },
  providers
);

console.log(running.origin); // e.g. http://127.0.0.1:5500
await stopLiveServer(running.id);
```

## Providers

`LiveServerHostProviders` supplies everything the Express middleware needs that
is host-specific:

| Method | Role |
| --- | --- |
| `listSnippets` | Resolve `kind: 'snippet'` script rows |
| `getVariables` | Global variables for script seeding and `runCommand` `{{variable}}` substitution |
| `runScript` | Execute pre/post request scripts |

The GUI wires the registry DB, Settings globals, and the SES utility-process
runner. The CLI wires SQLite snippets, CLI settings globals, and
`NodeScriptRunner`.

## Lifecycle helpers

```ts
import {
  listRunningLiveServers,
  stopAllLiveServers,
  updateLiveServerScripts
} from '@harborclient/live-server';

listRunningLiveServers(); // RunningLiveServer[]
updateLiveServerScripts(savedId, {
  preRequestScripts: [],
  postRequestScripts: []
});
await stopAllLiveServers();
```

## Product UI vs this package

Desktop users manage live servers in the HarborClient app
([Live servers](https://harborclient.com/live-servers/)). This package is the
headless runtime those features (and the CLI) call into.
