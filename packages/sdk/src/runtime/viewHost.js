import { clearContributionRegistry } from './contributionRegistry.js';
import {
  createBridgedPluginContext,
  executeLocalPluginCommand,
  installImportInvokeListener,
  mountContributionView,
  parseViewHostRole,
  resolveContributionKindFromUrl
} from './createBridgedPluginContext.js';
import { bridgeOn, installBridgeHandlers } from './hcBridge.js';
import { setHostReact, setHostReactDom } from './reactHost.js';

/**
 * Bootstraps an isolated plugin webview shell.
 *
 * Loads the plugin renderer bundle, runs activate(hc), and either registers
 * contributions with the host (agent role) or mounts one UI contribution (view role).
 *
 * @param {object} [options] - Bootstrap options; defaults are parsed from location.search.
 * @param {string} [options.pluginId] - Plugin manifest id from the shell URL hostname.
 * @param {string | null} [options.role] - Agent or view role query parameter.
 * @param {string | null} [options.contrib] - Manifest contribution id for view mode.
 * @param {string | null} [options.kind] - Contribution bucket for view mode.
 */
export async function bootstrapViewHost(options = {}) {
  installBridgeHandlers();

  const url = new URL(globalThis.location.href);
  const pluginId = options.pluginId ?? url.hostname;
  const roleParam = options.role ?? url.searchParams.get('role');
  const contrib = options.contrib ?? url.searchParams.get('contrib');
  const kind =
    options.kind ??
    url.searchParams.get('kind') ??
    resolveContributionKindFromUrl(contrib, url.searchParams);
  const slot = url.searchParams.get('slot') ?? 'content';

  const parsedRole = parseViewHostRole(
    roleParam === 'view' && contrib ? `view:${contrib}` : roleParam
  );
  const contributionId = parsedRole.contributionId ?? contrib ?? undefined;

  const [{ default: React }, { default: ReactDOM }, { default: ReactDOMClient }] =
    await Promise.all([
      import('harbor-plugin://host/react.js'),
      import('harbor-plugin://host/react-dom.js'),
      import('harbor-plugin://host/react-dom-client.js')
    ]);

  setHostReact(React);
  setHostReactDom(ReactDOM);

  const manifest = await fetch(`harbor-plugin://${pluginId}/manifest.json`).then((response) =>
    response.json()
  );

  clearContributionRegistry();

  const bundleUrl = `harbor-plugin://${pluginId}/bundle.js`;
  const module = await import(/* @vite-ignore */ bundleUrl);
  if (typeof module.activate !== 'function') {
    throw new Error(`Plugin ${pluginId} renderer entry must export activate(hc).`);
  }

  const hc = createBridgedPluginContext({
    pluginId,
    mode: parsedRole.mode,
    contributionId,
    react: React,
    manifest
  });

  if (parsedRole.mode === 'agent') {
    installImportInvokeListener();
  }

  await module.activate(hc);

  if (parsedRole.mode === 'agent') {
    bridgeOn('commands.execute', async (payload) => {
      const { commandId, args } = payload ?? {};
      await executeLocalPluginCommand(pluginId, commandId, ...(args ?? []));
    });
    await fetch(`harbor-plugin://${pluginId}/agent-ready`, { method: 'POST' });
    return;
  }

  if (!contributionId || !kind) {
    throw new Error('View webviews require contrib and kind query parameters.');
  }
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Plugin view shell is missing #root.');
  }
  mountContributionView({
    react: React,
    reactDom: ReactDOMClient,
    kind,
    contributionId,
    root,
    slot
  });
}

/**
 * Applies a theme snapshot pushed from the host renderer.
 *
 * @param {{ dataTheme?: string | null; cssText?: string | null }} theme - Theme payload.
 */
export function applyHostTheme(theme) {
  if (theme.dataTheme != null) {
    document.documentElement.setAttribute('data-theme', theme.dataTheme);
  }
  if (theme.cssText) {
    let style = document.getElementById('harbor-plugin-theme-vars');
    if (!style) {
      style = document.createElement('style');
      style.id = 'harbor-plugin-theme-vars';
      document.head.appendChild(style);
    }
    style.textContent = theme.cssText;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.__HARBORCLIENT_VIEW_HOST__ = {
    bootstrapViewHost,
    applyHostTheme
  };
}
