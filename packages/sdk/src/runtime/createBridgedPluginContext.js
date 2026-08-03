import {
  getContributionComponent,
  getContributionHeaderActions,
  registerContributionComponent,
  registerContributionHeaderActions
} from './contributionRegistry.js';
import { bridgeInvoke, bridgeOn } from './hcBridge.js';
import { openLivePage } from './livePageHandle.js';
import { createPluginDatabaseApi } from './pluginDatabaseApi.js';
import { setHostReact } from './reactHost.js';

/** @type {Map<string, Set<(...args: unknown[]) => void | Promise<void>>>} */
const commandHandlers = new Map();

/** @type {Map<string, import('../types').ImportHandler>} */
const importHandlersByRegistrationId = new Map();

/**
 * Parse callbacks for custom chat pointers, keyed by registration id.
 *
 * @type {Map<string, NonNullable<import('../types').PluginChatPointerConfig['parse']>>}
 */
const chatPointerParseByRegistrationId = new Map();

/** Monotonic id generator for import handler registrations within one webview. */
let importRegistrationCounter = 0;

/** Monotonic id generator for MCP server registrations within one webview. */
let mcpRegistrationCounter = 0;
let aiChatPointerRegistrationCounter = 0;

/** Plugin id prefix for built-in HarborClient host commands executed in the renderer. */
const HOST_COMMAND_OWNER = 'harborclient';

/** Guards repeated import invoke listener installation per webview load. */
let importInvokeListenerInstalled = false;

/** Guards repeated chat-pointer parse listener installation per webview load. */
let aiParseChatPointerListenerInstalled = false;

/**
 * Normalizes a file extension to lowercase with a leading dot.
 *
 * @param {string} extension - Extension with or without a leading dot.
 * @returns {string} Normalized extension such as `.json`, or an empty string when absent.
 */
function normalizeImportExtension(extension) {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

/**
 * Normalizes one extension or an array of extensions for handler registration.
 *
 * @param {string | string[]} extensions - Single extension or list of extensions.
 * @returns {string[]} Deduplicated normalized extensions.
 */
function normalizeImportExtensions(extensions) {
  const values = Array.isArray(extensions) ? extensions : [extensions];
  const normalized = values
    .map((extension) => normalizeImportExtension(extension))
    .filter((extension) => extension.length > 0);
  return [...new Set(normalized)];
}

/**
 * Subscribes to host-initiated import handler invocations for the agent webview.
 *
 * Must run once before plugin activation so File → Import can reach registered handlers.
 */
export function installImportInvokeListener() {
  if (importInvokeListenerInstalled) {
    return;
  }
  importInvokeListenerInstalled = true;

  bridgeOn('imports.invoke', async (payload) => {
    const { requestId, registrationId, phase, file } = payload ?? {};
    if (requestId == null || registrationId == null || phase == null) {
      return;
    }

    console.debug('[import]', 'invoke', {
      registrationId,
      phase,
      fileName: file?.name,
      extension: file?.extension
    });

    const handler = importHandlersByRegistrationId.get(String(registrationId));
    if (!handler) {
      await bridgeInvoke('imports.invokeComplete', {
        requestId,
        ok: false,
        error: `Unknown import handler registration: ${registrationId}`
      });
      return;
    }

    try {
      if (phase === 'canImport') {
        const result = Boolean(await handler.canImport(file));
        await bridgeInvoke('imports.invokeComplete', { requestId, ok: true, result });
        return;
      }
      if (phase === 'import') {
        await handler.import(file);
        await bridgeInvoke('imports.invokeComplete', { requestId, ok: true, result: undefined });
        return;
      }
      await bridgeInvoke('imports.invokeComplete', {
        requestId,
        ok: false,
        error: `Unsupported import handler phase: ${String(phase)}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await bridgeInvoke('imports.invokeComplete', {
        requestId,
        ok: false,
        error: message
      });
    }
  });
}

/**
 * Clears MCP server registration state — test helper only.
 */
export function resetMcpServersForTests() {
  mcpRegistrationCounter = 0;
  aiChatPointerRegistrationCounter = 0;
  chatPointerParseByRegistrationId.clear();
}

/**
 * Clears import handler state — test helper only.
 */
export function resetImportHandlersForTests() {
  importHandlersByRegistrationId.clear();
  importRegistrationCounter = 0;
  importInvokeListenerInstalled = false;
  aiParseChatPointerListenerInstalled = false;
  resetMcpServersForTests();
}

/**
 * Serializes a plugin chat-pointer match for the host bridge.
 *
 * @param {RegExp | string} match - Plugin-supplied match.
 * @returns {{ source: string; flags: string }}
 */
function serializeChatPointerMatch(match) {
  if (match instanceof RegExp) {
    return { source: match.source, flags: match.flags.replace(/g/g, '') };
  }
  return { source: String(match ?? ''), flags: '' };
}

/**
 * Subscribes to host-initiated chat-pointer parse invocations for the agent webview.
 *
 * Must run once before plugin activation so send/validate can reach registered parsers.
 */
export function installAiParseChatPointerListener() {
  if (aiParseChatPointerListenerInstalled) {
    return;
  }
  aiParseChatPointerListenerInstalled = true;

  bridgeOn('ai.parseChatPointer', async (payload) => {
    const { requestId, registrationId, matchGroups, fullToken, atIndex } = payload ?? {};
    if (requestId == null || registrationId == null) {
      return;
    }

    const parse = chatPointerParseByRegistrationId.get(String(registrationId));
    if (!parse) {
      await bridgeInvoke('ai.parseChatPointerComplete', {
        requestId,
        ok: false,
        error: `Unknown chat pointer parse registration: ${registrationId}`
      });
      return;
    }

    try {
      const groups = Array.isArray(matchGroups)
        ? matchGroups.map((g) => (g == null ? undefined : String(g)))
        : [];
      const synthetic = /** @type {RegExpMatchArray} */ (groups);
      synthetic.index = 0;
      synthetic.input = String(fullToken ?? '').replace(/^@/, '');
      const result = parse(synthetic, String(fullToken ?? ''), Number(atIndex) || 0);
      await bridgeInvoke('ai.parseChatPointerComplete', {
        requestId,
        ok: true,
        result: result ?? null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await bridgeInvoke('ai.parseChatPointerComplete', {
        requestId,
        ok: false,
        error: message
      });
    }
  });
}

/**
 * Normalizes one MCP header row from plugin registration input.
 *
 * @param {Record<string, unknown>} header - Raw header row.
 * @returns {{ key: string; value: string }}
 */
function normalizeMcpHeaderRow(header) {
  return {
    key: String(header?.key ?? '').trim(),
    value: String(header?.value ?? '')
  };
}

/**
 * Normalizes MCP client headers from plugin registration input.
 *
 * @param {unknown} headers - Raw headers array.
 * @returns {Array<{ key: string; value: string }>}
 */
function normalizeMcpHeaders(headers) {
  if (!Array.isArray(headers)) {
    return [];
  }
  return headers.map(normalizeMcpHeaderRow).filter((row) => row.key.length > 0);
}

/**
 * Validates an optional MCP server icon data URI.
 *
 * @param {unknown} icon - Optional icon from plugin registration input.
 * @returns {string | undefined} Normalized icon when valid.
 */
function normalizeMcpServerIcon(icon) {
  if (icon == null || icon === '') {
    return undefined;
  }
  const value = String(icon).trim();
  if (!/^data:image\/(?:png|jpeg|jpg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(value)) {
    throw new Error(
      'MCP server icon must be a base64 data URI (data:image/png;base64,... or data:image/svg+xml;base64,...).'
    );
  }
  return value;
}

/**
 * Normalizes plugin MCP server registration input for the host bridge.
 *
 * @param {Record<string, unknown>} config - Raw registration config.
 * @returns {{ name: string; serverURL: string; enabled: boolean; headers: Array<{ key: string; value: string }>; icon?: string }}
 */
function normalizeMcpServerConfig(config) {
  const name = String(config?.name ?? '').trim();
  const serverURL = String(config?.serverURL ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!name) {
    throw new Error('MCP server name is required.');
  }
  if (!serverURL) {
    throw new Error('MCP server URL is required.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(serverURL);
  } catch {
    throw new Error('MCP server URL must be an absolute HTTP or HTTPS URL.');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('MCP server URL must use http or https.');
  }

  return {
    name,
    serverURL,
    enabled: config?.enabled !== false,
    headers: normalizeMcpHeaders(config?.headers),
    icon: normalizeMcpServerIcon(config?.icon)
  };
}

/**
 * Parses a view-host role string into agent vs view contribution id.
 *
 * @param {string | null | undefined} role - Role query parameter from the shell URL.
 * @returns {{ mode: 'agent' | 'view'; contributionId?: string }}
 */
export function parseViewHostRole(role) {
  if (role == null || role === 'agent') {
    return { mode: 'agent' };
  }
  if (role.startsWith('view:')) {
    return { mode: 'view', contributionId: role.slice('view:'.length) };
  }
  if (role === 'view') {
    return { mode: 'view' };
  }
  return { mode: 'agent' };
}

/**
 * Builds a disposable handle that removes one command handler registration.
 *
 * @param {string} scopedId - Namespaced command id.
 * @param {(...args: unknown[]) => void | Promise<void>} handler - Handler to remove.
 * @returns {{ dispose: () => void }}
 */
function createCommandDisposable(scopedId, handler) {
  return {
    dispose: () => {
      const handlers = commandHandlers.get(scopedId);
      if (!handlers) {
        return;
      }
      handlers.delete(handler);
      if (handlers.size === 0) {
        commandHandlers.delete(scopedId);
      }
    }
  };
}

/**
 * Executes a registered plugin command inside this webview realm.
 *
 * @param {string} pluginId - Plugin manifest id.
 * @param {string} commandId - Command id declared in the manifest.
 * @param {unknown[]} args - Arguments passed to the handler.
 */
export async function executeLocalPluginCommand(pluginId, commandId, ...args) {
  const scopedId = `${pluginId}:${commandId}`;
  const handlers = commandHandlers.get(scopedId);
  if (!handlers) {
    throw new Error(`Unknown plugin command: ${scopedId}`);
  }
  for (const handler of handlers) {
    await handler(...args);
  }
}

/**
 * Creates the plugin activation context backed by the main-process broker.
 *
 * @param {object} options - Activation options parsed from the shell URL.
 * @param {string} options.pluginId - Plugin manifest id.
 * @param {'agent' | 'view'} options.mode - Agent runs logic; view renders one contribution.
 * @param {string | undefined} options.contributionId - Manifest contribution id for view mode.
 * @param {typeof import('react')} options.react - React namespace for this webview realm.
 * @param {Record<string, unknown>} options.manifest - Parsed plugin manifest.
 * @returns {import('../types').PluginContext}
 */
export function createBridgedPluginContext({ pluginId, mode, contributionId, react, manifest }) {
  const subscriptions = [];
  const permissions = new Set(manifest.permissions ?? []);
  const isAgent = mode === 'agent';

  /**
   * Wraps a cleanup function in an idempotent {@link Disposable}, auto-registers it
   * for host teardown on deactivation, and returns it.
   *
   * Idempotency keeps the legacy `subscriptions.push(register())` pattern and
   * manual `dispose()` safe — repeated dispose calls and host teardown never
   * double-fire the underlying cleanup.
   *
   * @param {() => void} dispose - Cleanup invoked on first dispose.
   * @returns {{ dispose: () => void }} Tracked disposable handle.
   */
  const track = (dispose) => {
    let disposed = false;
    const disposable = {
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        const index = subscriptions.indexOf(disposable);
        if (index >= 0) {
          subscriptions.splice(index, 1);
        }
        dispose();
      }
    };
    subscriptions.push(disposable);
    return disposable;
  };

  /**
   * Asserts that the plugin declared a permission in its manifest.
   *
   * @param {string} permission - Required permission flag.
   */
  const assertPermission = (permission) => {
    if (!permissions.has(permission)) {
      throw new Error(`Plugin ${pluginId} lacks permission: ${permission}`);
    }
  };

  /**
   * Asserts UI permission for contribution registration.
   */
  const assertUi = () => assertPermission('ui');

  /**
   * Asserts network permission for outbound HTTP via hc.host.fetch.
   */
  const assertNetwork = () => assertPermission('network');

  /**
   * Returns whether UI registration should run in this webview role.
   */
  const canRegisterUi = () => isAgent || mode === 'view';

  /**
   * Asserts MCP permission for remote MCP client registration.
   */
  const assertMcp = () => assertPermission('mcp');

  /**
   * Asserts AI permission for chat pointer registration and copy-to-chat.
   */
  const assertAi = () => assertPermission('ai');

  /**
   * Asserts browser permission for embedded live page control.
   */
  const assertBrowser = () => assertPermission('browser');

  /**
   * Asserts live-server permission for Harbor Live Server APIs.
   */
  const assertLiveServer = () => assertPermission('live-server');

  /**
   * Asserts live-pages permission for saved live page (website) APIs.
   */
  const assertLivePages = () => assertPermission('live-pages');

  /**
   * Invokes a livePage session op on the host renderer via the plugin bridge.
   *
   * @param {Record<string, unknown>} req - ScriptLivePageRequest-shaped payload.
   * @returns {Promise<unknown>} Host session result.
   */
  const callLivePage = async (req) => {
    const op = String(req.op ?? '');
    switch (op) {
      case 'open':
        return bridgeInvoke('livePage.open', { url: req.url, reuse: req.reuse });
      case 'focus':
        return bridgeInvoke('livePage.focus', { tabId: req.tabId });
      case 'close':
        return bridgeInvoke('livePage.close', { tabId: req.tabId });
      case 'query':
        return bridgeInvoke('livePage.query', {
          tabId: req.tabId,
          selector: req.selector,
          all: req.all,
          maxElements: req.maxElements
        });
      case 'evaluate':
        return bridgeInvoke('livePage.evaluate', {
          tabId: req.tabId,
          expression: req.expression
        });
      case 'injectScript':
        return bridgeInvoke('livePage.injectScript', { tabId: req.tabId, source: req.source });
      case 'injectStylesheet':
        return bridgeInvoke('livePage.injectStylesheet', { tabId: req.tabId, css: req.css });
      case 'screenshot':
        return bridgeInvoke('livePage.screenshot', {
          tabId: req.tabId,
          fullPage: req.fullPage === true
        });
      case 'goBack':
        return bridgeInvoke('livePage.goBack', { tabId: req.tabId });
      case 'goForward':
        return bridgeInvoke('livePage.goForward', { tabId: req.tabId });
      case 'reload':
        return bridgeInvoke('livePage.reload', { tabId: req.tabId });
      case 'navigate':
        return bridgeInvoke('livePage.navigate', { tabId: req.tabId, url: req.url });
      default:
        throw new Error(`Unsupported livePage bridge op: ${op}`);
    }
  };

  /**
   * Asserts that a contribution id is declared in manifest.contributes.
   *
   * @param {string} key - contributes.* key.
   * @param {string} id - Contribution id.
   */
  const assertManifestContribution = (key, id) => {
    const entries = manifest.contributes?.[key];
    if (!Array.isArray(entries) || !entries.some((entry) => entry.id === id)) {
      throw new Error(`Contribution id "${id}" is not declared in manifest.contributes.${key}.`);
    }
  };

  /**
   * Reads `replaces` from a sidebar panel manifest entry (manifest-authoritative).
   *
   * @param {string} contributionId - Raw contribution id.
   * @returns {'collections'|undefined}
   */
  const getSidebarPanelReplaces = (contributionId) => {
    const entry = manifest.contributes?.sidebarPanels?.find((panel) => panel.id === contributionId);
    return entry?.replaces === 'collections' ? 'collections' : undefined;
  };

  /**
   * Asserts that a menu command is declared in manifest.contributes.menus.
   *
   * @param {string} command - Command id referenced by the menu item.
   */
  const assertManifestMenuCommand = (command) => {
    const entries = manifest.contributes?.menus;
    if (!Array.isArray(entries) || !entries.some((entry) => entry.command === command)) {
      throw new Error(`Command "${command}" is not declared in manifest.contributes.menus.`);
    }
  };

  /**
   * Registers a UI contribution locally and forwards metadata to the host when agent.
   *
   * @param {string} kind - Contribution bucket key.
   * @param {string} id - Manifest contribution id.
   * @param {Record<string, unknown>} metadata - Serializable metadata for the host registry.
   * @param {unknown} component - React component registered in this realm.
   * @param {object} [options] - Optional headerActions components.
   * @param {unknown} [options.headerActions] - Sidebar section header actions component.
   * @returns {{ dispose: () => void }}
   */
  const registerUiContribution = (kind, id, metadata, component, options = {}) => {
    assertUi();
    registerContributionComponent(kind, id, component);
    if (options.headerActions) {
      registerContributionHeaderActions(id, options.headerActions);
    }

    if (isAgent) {
      void bridgeInvoke('registerContribution', {
        kind,
        contribution: { pluginId, ...metadata }
      });
    }

    return track(() => {
      if (isAgent) {
        void bridgeInvoke('unregisterContribution', { kind, contributionId: id });
      }
    });
  };

  /**
   * No-op UI registration in view webviews (agent owns metadata).
   *
   * @returns {{ dispose: () => void }}
   */
  const noopDisposable = () => ({ dispose: () => {} });

  setHostReact(react);

  return {
    pluginId,
    react,
    subscriptions,
    storage: {
      get: async (key) => {
        assertPermission('storage');
        return bridgeInvoke('storage.get', { key });
      },
      set: async (key, value) => {
        assertPermission('storage');
        await bridgeInvoke('storage.set', { key, value });
      }
    },
    database: createPluginDatabaseApi({
      query: (mode, sql, params, txnId) => {
        assertPermission('database');
        return bridgeInvoke('database.query', { mode, sql, params, txnId });
      },
      exec: (sql) => {
        assertPermission('database');
        return bridgeInvoke('database.exec', { sql });
      },
      beginTransaction: () => {
        assertPermission('database');
        return bridgeInvoke('database.beginTransaction');
      },
      endTransaction: (txnId, action) => {
        assertPermission('database');
        return bridgeInvoke('database.endTransaction', { txnId, action });
      }
    }),
    fs: {
      pickFile: async (options) => {
        assertPermission('filesystem:pick');
        return bridgeInvoke('fs.pickFile', { options });
      },
      pickDirectory: async (defaultPath) => {
        assertPermission('filesystem:pick');
        return bridgeInvoke('fs.pickDirectory', { defaultPath: defaultPath ?? '' });
      },
      saveFile: async (content, options) => {
        assertPermission('filesystem:pick');
        return bridgeInvoke('fs.saveFile', { content, options });
      },
      readFile: async (path) => {
        assertPermission('filesystem:read');
        return bridgeInvoke('fs.readFile', { path });
      },
      writeFile: async (path, content) => {
        assertPermission('filesystem:write');
        await bridgeInvoke('fs.writeFile', { path, content });
      },
      writeBytes: async (path, bytes) => {
        assertPermission('filesystem:write');
        const u8 =
          bytes instanceof Uint8Array
            ? bytes
            : new Uint8Array(/** @type {ArrayLike<number>} */ (bytes));
        let binary = '';
        for (let i = 0; i < u8.length; i += 1) {
          binary += String.fromCharCode(u8[i] ?? 0);
        }
        return bridgeInvoke('fs.writeBytes', { path, base64: btoa(binary) });
      },
      watchFile: (path, listener) => {
        assertPermission('filesystem:read');
        const unsubscribe = bridgeOn(`fs.watch:${path}`, () => {
          listener(path);
        });
        void bridgeInvoke('fs.watchFile', { path });
        return track(unsubscribe);
      }
    },
    commands: {
      register: (id, handler) => {
        assertUi();
        assertManifestContribution('commands', id);
        if (!isAgent) {
          return noopDisposable();
        }
        const scopedId = `${pluginId}:${id}`;
        const handlers = commandHandlers.get(scopedId) ?? new Set();
        handlers.add(handler);
        commandHandlers.set(scopedId, handlers);
        return track(createCommandDisposable(scopedId, handler).dispose);
      },
      execute: async (id, ...args) => {
        const [ownerId, commandId] = id.includes(':') ? id.split(':', 2) : [pluginId, id];
        if (ownerId === pluginId) {
          await executeLocalPluginCommand(ownerId, commandId, ...args);
          return;
        }
        if (ownerId === HOST_COMMAND_OWNER) {
          console.debug('[import]', 'commands.execute', { commandId, args });
          await bridgeInvoke('commands.execute', { pluginId: ownerId, commandId, args });
          return;
        }
        await bridgeInvoke('commands.executeRemote', { pluginId: ownerId, commandId, args });
      }
    },
    actions: {
      register: (namespace, handlers) => {
        assertUi();
        if (!isAgent) {
          return noopDisposable();
        }

        const disposables = [];
        for (const [label, handler] of Object.entries(handlers ?? {})) {
          const commandId = `action:${namespace}:${label}`;
          const scopedId = `${pluginId}:${commandId}`;
          const commandHandlersForId = commandHandlers.get(scopedId) ?? new Set();
          commandHandlersForId.add(handler);
          commandHandlers.set(scopedId, commandHandlersForId);
          disposables.push(createCommandDisposable(scopedId, handler));

          void bridgeInvoke('registerContribution', {
            kind: 'actions',
            contribution: {
              pluginId,
              namespace,
              label,
              commandId
            }
          });
          disposables.push({
            dispose: () => {
              void bridgeInvoke('unregisterContribution', {
                kind: 'actions',
                contributionId: `${namespace}:${label}`
              });
            }
          });
        }

        return track(() => {
          for (const disposable of disposables) {
            disposable.dispose();
          }
        });
      }
    },
    themes: {
      register: (theme) => {
        assertUi();
        assertManifestContribution('themes', theme.id);
        if (!isAgent) {
          return noopDisposable();
        }
        void bridgeInvoke('themes.register', { theme });
        return track(() => {
          void bridgeInvoke('themes.unregister', { themeId: theme.id });
        });
      },
      getActive: async () => bridgeInvoke('themes.getActive'),
      onDidChange: (listener) => {
        const unsubscribe = bridgeOn('themes.changed', listener);
        void bridgeInvoke('themes.getActive').then(listener);
        return track(unsubscribe);
      }
    },
    ui: {
      registerSettingsSection: (section) => {
        assertManifestContribution('settingsSections', section.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'settingsSections',
          section.id,
          {
            id: `plugin:${pluginId}:${section.id}`,
            title: section.title,
            contributionId: section.id
          },
          section.Component
        );
      },
      registerSidebarPanel: (panel) => {
        assertManifestContribution('sidebarPanels', panel.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        const replaces = getSidebarPanelReplaces(panel.id);
        return registerUiContribution(
          'sidebarPanels',
          panel.id,
          {
            id: `plugin:${pluginId}:${panel.id}`,
            title: panel.title,
            icon: panel.icon,
            order: panel.order,
            contributionId: panel.id,
            ...(replaces ? { replaces } : {})
          },
          panel.Component
        );
      },
      registerSidebarRailItem: (item) => {
        assertManifestContribution('sidebarRailItems', item.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'sidebarRailItems',
          item.id,
          {
            id: `plugin:${pluginId}:${item.id}`,
            title: item.title,
            icon: item.icon,
            order: item.order,
            contributionId: item.id
          },
          item.Component
        );
      },
      registerSidebarSection: (section) => {
        assertManifestContribution('sidebarSections', section.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'sidebarSections',
          section.id,
          {
            id: `plugin:${pluginId}:${section.id}`,
            title: section.title,
            order: section.order,
            contributionId: section.id,
            hasHeaderActions: Boolean(section.headerActions)
          },
          section.Component,
          { headerActions: section.headerActions }
        );
      },
      registerMainView: (view) => {
        assertManifestContribution('mainViews', view.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'mainViews',
          view.id,
          { id: `plugin:${pluginId}:${view.id}`, title: view.title, contributionId: view.id },
          view.Component
        );
      },
      registerModal: (modal) => {
        assertManifestContribution('modals', modal.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'modals',
          modal.id,
          { id: `plugin:${pluginId}:${modal.id}`, title: modal.title, contributionId: modal.id },
          modal.Component
        );
      },
      registerRequestTab: (tab) => {
        assertManifestContribution('requestTabs', tab.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'requestTabs',
          tab.id,
          {
            id: `plugin:${pluginId}:${tab.id}`,
            title: tab.title,
            order: tab.order,
            contributionId: tab.id
          },
          tab.Component
        );
      },
      registerResponseTab: (tab) => {
        assertManifestContribution('responseTabs', tab.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'responseTabs',
          tab.id,
          {
            id: `plugin:${pluginId}:${tab.id}`,
            title: tab.title,
            order: tab.order,
            when: tab.when,
            contributionId: tab.id
          },
          tab.Component
        );
      },
      registerCollectionSettingsTab: (tab) => {
        assertManifestContribution('collectionSettingsTabs', tab.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'collectionSettingsTabs',
          tab.id,
          {
            id: `plugin:${pluginId}:${tab.id}`,
            title: tab.title,
            order: tab.order,
            contributionId: tab.id
          },
          tab.Component
        );
      },
      registerFooterPanel: (panel) => {
        assertManifestContribution('footerPanels', panel.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'footerPanels',
          panel.id,
          {
            id: `plugin:${pluginId}:${panel.id}`,
            title: panel.title,
            contributionId: panel.id
          },
          panel.Component
        );
      },
      setFooterPanelIndicator: (panelId, state) => {
        assertUi();
        assertManifestContribution('footerPanels', panelId);
        void bridgeInvoke('ui.setFooterPanelIndicator', { panelId, state });
      },
      registerMenuItem: (item) => {
        assertManifestMenuCommand(item.command);
        if (!isAgent) {
          return noopDisposable();
        }
        void bridgeInvoke('registerContribution', {
          kind: 'menuItems',
          contribution: {
            pluginId,
            menu: item.menu,
            command: item.command,
            label: item.label,
            group: item.group,
            order: item.order
          }
        });
        return track(() => {
          void bridgeInvoke('unregisterContribution', {
            kind: 'menuItems',
            contributionId: `${item.menu}:${item.command}`
          });
        });
      },
      registerRequestToolbarAction: (action) => {
        assertManifestContribution('requestToolbarActions', action.id);
        if (!isAgent) {
          return noopDisposable();
        }
        void bridgeInvoke('registerContribution', {
          kind: 'requestToolbarActions',
          contribution: {
            pluginId,
            id: action.id,
            title: action.title,
            command: action.command,
            icon: action.icon,
            order: action.order
          }
        });
        return track(() => {
          void bridgeInvoke('unregisterContribution', {
            kind: 'requestToolbarActions',
            contributionId: action.id
          });
        });
      },
      registerLivePageChromeAction: (action) => {
        assertManifestContribution('livePageChromeActions', action.id);
        if (!isAgent) {
          return noopDisposable();
        }
        void bridgeInvoke('registerContribution', {
          kind: 'livePageChromeActions',
          contribution: {
            pluginId,
            id: action.id,
            title: action.title,
            command: action.command,
            icon: action.icon
          }
        });
        return track(() => {
          void bridgeInvoke('unregisterContribution', {
            kind: 'livePageChromeActions',
            contributionId: action.id
          });
        });
      },
      registerScriptEditorAction: (action) => {
        assertManifestContribution('scriptEditorActions', action.id);
        if (!isAgent) {
          return noopDisposable();
        }
        void bridgeInvoke('registerContribution', {
          kind: 'scriptEditorActions',
          contribution: {
            pluginId,
            id: action.id,
            title: action.title,
            command: action.command,
            icon: action.icon,
            order: action.order,
            phases: action.phases
          }
        });
        return track(() => {
          void bridgeInvoke('unregisterContribution', {
            kind: 'scriptEditorActions',
            contributionId: action.id
          });
        });
      },
      registerWorkflowToolbarAction: (action) => {
        assertManifestContribution('workflowToolbarActions', action.id);
        if (!isAgent) {
          return noopDisposable();
        }
        void bridgeInvoke('registerContribution', {
          kind: 'workflowToolbarActions',
          contribution: {
            pluginId,
            id: action.id,
            title: action.title,
            command: action.command,
            icon: action.icon,
            order: action.order
          }
        });
        return track(() => {
          void bridgeInvoke('unregisterContribution', {
            kind: 'workflowToolbarActions',
            contributionId: action.id
          });
        });
      },
      registerWorkflowActionBlock: (block) => {
        assertManifestContribution('workflowActionBlocks', block.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'workflowActionBlocks',
          block.id,
          {
            id: `plugin:${pluginId}:${block.id}`,
            title: block.title,
            order: block.order,
            actionTypes: block.actionTypes,
            contributionId: block.id
          },
          block.Component
        );
      },
      registerContextMenuItem: (item) => {
        assertManifestContribution('contextMenus', item.id);
        if (!isAgent) {
          return noopDisposable();
        }
        void bridgeInvoke('registerContribution', {
          kind: 'contextMenuItems',
          contribution: {
            pluginId,
            id: item.id,
            title: item.title,
            command: item.command,
            when: item.when,
            group: item.group,
            order: item.order
          }
        });
        return track(() => {
          void bridgeInvoke('unregisterContribution', {
            kind: 'contextMenuItems',
            contributionId: item.id
          });
        });
      },
      registerStatusBarItem: (item) => {
        assertManifestContribution('statusBarItems', item.id);
        if (!canRegisterUi()) {
          return noopDisposable();
        }
        return registerUiContribution(
          'statusBarItems',
          item.id,
          {
            id: `plugin:${pluginId}:${item.id}`,
            alignment: item.alignment,
            order: item.order,
            contributionId: item.id
          },
          item.Component
        );
      },
      showToast: (message, options) => {
        assertUi();
        void bridgeInvoke('ui.showToast', { message, options });
      },
      openModal: (modalId, context) => {
        assertUi();
        void bridgeInvoke('ui.openModal', { modalId, context });
      },
      closeModal: (modalId) => {
        assertUi();
        void bridgeInvoke('ui.closeModal', { modalId });
      }
    },
    http: {
      onAfterSend: (handler) => {
        assertPermission('http');
        const unsubscribe = bridgeOn('http.afterSend', (payload) => {
          const { request, response } = payload ?? {};
          return handler(request, response);
        });
        return track(unsubscribe);
      }
    },
    ipc: {
      invoke: async (channel, ...args) => {
        assertPermission('ipc');
        return bridgeInvoke('ipc.invoke', { channel, args });
      }
    },
    host: {
      openRequestDraft: async (payload) => {
        assertUi();
        await bridgeInvoke('host.openRequestDraft', { payload });
      },
      applyRequestDraft: async (payload) => {
        assertUi();
        await bridgeInvoke('host.applyRequestDraft', { payload });
      },
      loadRequest: async (requestId) => {
        assertUi();
        await bridgeInvoke('host.loadRequest', { requestId });
      },
      loadDocument: async (documentId) => {
        assertUi();
        await bridgeInvoke('host.loadDocument', { documentId });
      },
      openCollectionSettings: async (collectionId) => {
        assertUi();
        await bridgeInvoke('host.openCollectionSettings', { collectionId });
      },
      openCollectionRunner: async (collectionId) => {
        assertUi();
        await bridgeInvoke('host.openCollectionRunner', { collectionId });
      },
      openShareModal: async (collectionId) => {
        assertUi();
        await bridgeInvoke('host.openShareModal', { collectionId });
      },
      showEntityContextMenu: async (input) => {
        assertUi();
        await bridgeInvoke('host.showEntityContextMenu', input);
      },
      getSidebarSelection: async () => {
        assertUi();
        return bridgeInvoke('host.getSidebarSelection');
      },
      setSidebarSelection: async (selection) => {
        assertUi();
        await bridgeInvoke('host.setSidebarSelection', { selection });
      },
      onSidebarSelectionChanged: (listener) => {
        assertUi();
        const unsubscribe = bridgeOn('sidebar.selection.changed', listener);
        return track({
          dispose: () => {
            unsubscribe();
          }
        });
      },
      send: async () => {
        assertUi();
        await bridgeInvoke('host.send');
      },
      createEnvironmentWithVariables: async (name, variables) => {
        assertUi();
        return bridgeInvoke('host.createEnvironmentWithVariables', { name, variables });
      },
      updateEnvironmentVariables: async (environmentId, variables) => {
        assertUi();
        await bridgeInvoke('host.updateEnvironmentVariables', { environmentId, variables });
      },
      createCollection: async (payload) => {
        assertUi();
        return bridgeInvoke('host.createCollection', { payload });
      },
      updateCollection: async (input) => {
        assertUi();
        return bridgeInvoke('host.updateCollection', input);
      },
      deleteCollection: async (collectionId) => {
        assertUi();
        await bridgeInvoke('host.deleteCollection', { collectionId });
      },
      reorderCollections: async (orderedIds) => {
        assertUi();
        await bridgeInvoke('host.reorderCollections', { orderedIds });
      },
      setCollectionArchived: async (input) => {
        assertUi();
        await bridgeInvoke('host.setCollectionArchived', input);
      },
      duplicateCollection: async (collectionId) => {
        assertUi();
        return bridgeInvoke('host.duplicateCollection', { collectionId });
      },
      createFolder: async (input) => {
        assertUi();
        return bridgeInvoke('host.createFolder', input);
      },
      renameFolder: async (input) => {
        assertUi();
        return bridgeInvoke('host.renameFolder', input);
      },
      deleteFolder: async (input) => {
        assertUi();
        await bridgeInvoke('host.deleteFolder', input);
      },
      moveFolder: async (input) => {
        assertUi();
        return bridgeInvoke('host.moveFolder', input);
      },
      reorderFolders: async (input) => {
        assertUi();
        await bridgeInvoke('host.reorderFolders', input);
      },
      createRequest: async (input) => {
        assertUi();
        return bridgeInvoke('host.createRequest', input);
      },
      deleteRequest: async (requestId) => {
        assertUi();
        await bridgeInvoke('host.deleteRequest', { requestId });
      },
      duplicateRequest: async (requestId) => {
        assertUi();
        return bridgeInvoke('host.duplicateRequest', { requestId });
      },
      moveRequest: async (input) => {
        assertUi();
        await bridgeInvoke('host.moveRequest', input);
      },
      reorderRequests: async (input) => {
        assertUi();
        await bridgeInvoke('host.reorderRequests', input);
      },
      createDocument: async (input) => {
        assertUi();
        return bridgeInvoke('host.createDocument', input);
      },
      renameDocument: async (input) => {
        assertUi();
        return bridgeInvoke('host.renameDocument', input);
      },
      deleteDocument: async (input) => {
        assertUi();
        await bridgeInvoke('host.deleteDocument', input);
      },
      moveDocument: async (input) => {
        assertUi();
        await bridgeInvoke('host.moveDocument', input);
      },
      reorderDocuments: async (input) => {
        assertUi();
        await bridgeInvoke('host.reorderDocuments', input);
      },
      reorderContainerItems: async (input) => {
        assertUi();
        await bridgeInvoke('host.reorderContainerItems', input);
      },
      listCollections: async (options) => {
        assertUi();
        return bridgeInvoke('host.listCollections', { options });
      },
      listFolders: async (collectionId) => {
        assertUi();
        return bridgeInvoke('host.listFolders', { collectionId });
      },
      listRequests: async (collectionId) => {
        assertUi();
        return bridgeInvoke('host.listRequests', { collectionId });
      },
      listDocuments: async (collectionId) => {
        assertUi();
        return bridgeInvoke('host.listDocuments', { collectionId });
      },
      listLibraryTree: async (options) => {
        assertUi();
        return bridgeInvoke('host.listLibraryTree', { options });
      },
      onLibraryChanged: (listener) => {
        assertUi();
        const unsubscribe = bridgeOn('library.changed', listener);
        return track({
          dispose: () => {
            unsubscribe();
          }
        });
      },
      listWorkflows: async () => {
        assertUi();
        return bridgeInvoke('host.listWorkflows');
      },
      getWorkflow: async (workflowId) => {
        assertUi();
        return bridgeInvoke('host.getWorkflow', { workflowId });
      },
      createWorkflow: async (input) => {
        assertUi();
        return bridgeInvoke('host.createWorkflow', { input });
      },
      updateWorkflow: async (input) => {
        assertUi();
        return bridgeInvoke('host.updateWorkflow', { input });
      },
      renameWorkflow: async (workflowId, name) => {
        assertUi();
        return bridgeInvoke('host.renameWorkflow', { workflowId, name });
      },
      deleteWorkflow: async (workflowId) => {
        assertUi();
        await bridgeInvoke('host.deleteWorkflow', { workflowId });
      },
      onWorkflowsChanged: (listener) => {
        assertUi();
        const unsubscribe = bridgeOn('workflows.changed', listener);
        return track({
          dispose: () => {
            unsubscribe();
          }
        });
      },
      listCollectionRequests: async (collectionId, folderId) => {
        assertUi();
        return bridgeInvoke('host.listCollectionRequests', { collectionId, folderId });
      },
      getCollectionMetadata: async (collectionId) => {
        assertUi();
        return bridgeInvoke('host.getCollectionMetadata', { collectionId });
      },
      logRequestToConsole: async (payload) => {
        assertUi();
        await bridgeInvoke('host.logRequestToConsole', { payload });
      },
      fetch: async (input, init) => {
        assertNetwork();
        return bridgeInvoke('host.fetch', { input, init });
      },
      clearResponse: async () => {
        assertUi();
        await bridgeInvoke('host.clearResponse');
      },
      openImageView: async (payload) => {
        assertUi();
        await bridgeInvoke('host.openImageView', { payload });
      }
    },
    imports: {
      registerHandler: (extensions, handler) => {
        assertUi();
        if (!isAgent) {
          return noopDisposable();
        }
        const normalizedExtensions = normalizeImportExtensions(extensions);
        if (normalizedExtensions.length === 0) {
          throw new Error(
            'At least one file extension is required for import handler registration.'
          );
        }
        const registrationId = String(++importRegistrationCounter);
        importHandlersByRegistrationId.set(registrationId, handler);
        console.debug('[import]', 'registerHandler', {
          registrationId,
          extensions: normalizedExtensions
        });
        void bridgeInvoke('imports.registerHandler', {
          registrationId,
          extensions: normalizedExtensions
        });
        return track(() => {
          importHandlersByRegistrationId.delete(registrationId);
          void bridgeInvoke('imports.unregisterHandler', { registrationId });
        });
      }
    },
    mcp: {
      registerServer: (config) => {
        assertMcp();
        if (!isAgent) {
          return noopDisposable();
        }
        const normalized = normalizeMcpServerConfig(config ?? {});
        const registrationId = String(++mcpRegistrationCounter);
        void bridgeInvoke('mcp.registerServer', {
          registrationId,
          ...normalized
        });
        return track(() => {
          void bridgeInvoke('mcp.unregisterServer', { registrationId });
        });
      }
    },
    liveServers: {
      list: async () => {
        assertLiveServer();
        return bridgeInvoke('liveServers.list');
      },
      get: async (idOrUuid) => {
        assertLiveServer();
        return bridgeInvoke('liveServers.get', { idOrUuid });
      },
      create: async (input) => {
        assertLiveServer();
        return bridgeInvoke('liveServers.create', { input });
      },
      update: async (input) => {
        assertLiveServer();
        return bridgeInvoke('liveServers.update', { input });
      },
      delete: async (id) => {
        assertLiveServer();
        await bridgeInvoke('liveServers.delete', { id });
      },
      start: async (input) => {
        assertLiveServer();
        return bridgeInvoke('liveServers.start', { input });
      },
      stop: async (query) => {
        assertLiveServer();
        await bridgeInvoke('liveServers.stop', { query });
      },
      listRunning: async () => {
        assertLiveServer();
        return bridgeInvoke('liveServers.listRunning');
      },
      getStatus: async (query) => {
        assertLiveServer();
        return bridgeInvoke('liveServers.getStatus', { query });
      },
      getLogs: async (query) => {
        assertLiveServer();
        return bridgeInvoke('liveServers.getLogs', { query });
      },
      clearLogs: async (query) => {
        assertLiveServer();
        await bridgeInvoke('liveServers.clearLogs', { query });
      },
      onRunningChanged: (listener) => {
        assertLiveServer();
        const unsubscribe = bridgeOn('liveServers.runningChanged', listener);
        return track({
          dispose: () => {
            unsubscribe();
          }
        });
      },
      onRequestLog: (listener) => {
        assertLiveServer();
        const unsubscribe = bridgeOn('liveServers.requestLog', listener);
        return track({
          dispose: () => {
            unsubscribe();
          }
        });
      }
    },
    livePages: {
      list: async () => {
        assertLivePages();
        return bridgeInvoke('livePages.list');
      },
      get: async (idOrUuid) => {
        assertLivePages();
        return bridgeInvoke('livePages.get', { idOrUuid });
      },
      create: async (input) => {
        assertLivePages();
        return bridgeInvoke('livePages.create', { input });
      },
      update: async (input) => {
        assertLivePages();
        return bridgeInvoke('livePages.update', { input });
      },
      delete: async (id) => {
        assertLivePages();
        await bridgeInvoke('livePages.delete', { id });
      }
    },
    ai: {
      registerChatPointer: (config) => {
        assertAi();
        if (!isAgent) {
          return noopDisposable();
        }
        const pointerId = String(config?.id ?? '').trim();
        if (!/^[a-z][a-z0-9-]*$/.test(pointerId)) {
          throw new Error(`Invalid chat pointer id: ${pointerId}`);
        }
        const hasMatch = config?.match != null && config.match !== '';
        const hasParse = typeof config?.parse === 'function';
        if (hasMatch !== hasParse) {
          throw new Error('Chat pointer match and parse must be provided together.');
        }

        const registrationId = String(++aiChatPointerRegistrationCounter);
        /** @type {{ source: string; flags: string } | undefined} */
        let matchPayload;
        if (hasMatch) {
          matchPayload = serializeChatPointerMatch(/** @type {RegExp | string} */ (config.match));
          chatPointerParseByRegistrationId.set(registrationId, config.parse);
        }

        void bridgeInvoke('ai.registerChatPointer', {
          registrationId,
          pointerId,
          agentGuidance: config?.agentGuidance,
          ...(matchPayload != null ? { match: matchPayload } : {})
        });
        return track(() => {
          chatPointerParseByRegistrationId.delete(registrationId);
          void bridgeInvoke('ai.unregisterChatPointer', { registrationId });
        });
      },
      copyToChat: async (input) => {
        assertAi();
        await bridgeInvoke('ai.copyToChat', {
          pointerId: String(input?.pointerId ?? '').trim(),
          key: input?.key != null ? String(input.key).trim() : undefined,
          token: input?.token != null ? String(input.token).trim() : undefined,
          label: String(input?.label ?? '').trim(),
          context: String(input?.context ?? ''),
          selection: input?.selection
        });
      }
    },
    /**
     * Opens or reuses an embedded browser tab and returns a control handle.
     *
     * Requires the `browser` permission. Same semantics as request-script `hc.livePage`.
     *
     * @param {string} [url] - Optional URL; omit to bind the active browser tab.
     * @param {{ reuse?: boolean }} [options] - Optional `{ reuse }` (default true).
     * @returns {Promise<import('../types').PluginLivePageHandle>} Webpage handle.
     */
    livePage: async (url, options) => {
      assertBrowser();
      /**
       * Writes screenshot PNG bytes via the plugin filesystem bridge.
       *
       * @param {string} path - Relative or absolute allowlisted path.
       * @param {string} pngBase64 - Base64-encoded PNG payload.
       * @returns {Promise<string>} Absolute written path.
       */
      const writeScreenshotBytes = async (path, pngBase64) => {
        assertPermission('filesystem:write');
        const result = await bridgeInvoke('fs.writeBytes', { path, base64: pngBase64 });
        if (typeof result !== 'string' || !result.trim()) {
          throw new Error('hc.livePage().screenshot failed to resolve write path');
        }
        return result;
      };
      return openLivePage(callLivePage, url, options, writeScreenshotBytes);
    }
  };
}

/**
 * Maps a manifest contributes key to the contribution registry bucket name.
 *
 * @param {string} contributionId - Manifest contribution id for view mode.
 * @returns {string | undefined}
 */
export function resolveContributionKindFromUrl(contributionId, searchParams) {
  const kind = searchParams.get('kind');
  return kind ?? undefined;
}

/**
 * Mounts one contribution component into the view webview root element.
 *
 * @param {object} options - Mount options.
 * @param {typeof import('react')} options.react - React namespace.
 * @param {typeof import('react-dom/client')} options.reactDom - React DOM client namespace.
 * @param {string} options.kind - Contribution bucket.
 * @param {string} options.contributionId - Manifest contribution id.
 * @param {HTMLElement} options.root - DOM mount target.
 * @param {'content' | 'headerActions'} [options.slot] - Contribution sub-slot.
 * @returns {() => void} Cleanup function that unmounts the React root.
 */
export function mountContributionView({
  react,
  reactDom,
  kind,
  contributionId,
  root,
  slot = 'content'
}) {
  let Component;
  if (slot === 'headerActions') {
    Component = getContributionHeaderActions(contributionId);
  } else {
    Component = getContributionComponent(kind, contributionId);
  }
  if (Component == null) {
    throw new Error(`Unknown plugin contribution: ${kind}:${contributionId}`);
  }

  /** @type {unknown} */
  let currentContext = null;

  const needsContext =
    kind === 'requestTabs' ||
    kind === 'responseTabs' ||
    kind === 'collectionSettingsTabs' ||
    kind === 'modals';

  const reactRoot = reactDom.createRoot(root);

  /**
   * Renders the contribution with the latest pushed context snapshot. For
   * context-bearing contributions the first render is deferred until a context
   * snapshot is available so the component never receives a null context.
   */
  const render = () => {
    if (needsContext && currentContext == null) {
      return;
    }
    const element = needsContext
      ? react.createElement(Component, { context: currentContext })
      : react.createElement(Component);
    reactRoot.render(element);
  };

  /** @type {Set<string>} */
  const FILL_SURFACE_KINDS = new Set([
    'footerPanels',
    'statusBarItems',
    'requestTabs',
    'responseTabs',
    'collectionSettingsTabs',
    'modals',
    'mainViews',
    'sidebarPanels',
    'sidebarRailItems'
  ]);

  if (FILL_SURFACE_KINDS.has(kind) && slot === 'content') {
    document.body.classList.add('plugin-surface-fill');
  }

  if (slot === 'headerActions') {
    document.body.classList.add('plugin-surface-header-actions');
    document.documentElement.classList.add('plugin-surface-header-actions');
    root.style.display = 'inline-flex';
    root.style.width = 'fit-content';
    root.style.maxWidth = '100%';
    root.style.overflow = 'hidden';
  }

  /** @type {ResizeObserver | null} */
  let resizeObserver = null;
  /** @type {number | null} */
  let resizeFrame = null;

  if (slot === 'content' && !FILL_SURFACE_KINDS.has(kind)) {
    /**
     * Reports the full content height so the host webview can grow without an inner scrollbar.
     */
    const reportDocumentHeight = () => {
      const height = Math.ceil(
        Math.max(root.scrollHeight, root.getBoundingClientRect().height, root.offsetHeight)
      );
      if (height <= 0) {
        return;
      }
      if (resizeFrame != null) {
        cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          void bridgeInvoke('view.reportSize', { height, slot: 'content' });
        });
      });
    };

    resizeObserver = new ResizeObserver(() => {
      reportDocumentHeight();
    });
    resizeObserver.observe(root);

    /**
     * Re-reports after React paints so context-deferred tabs measure their full form height.
     */
    const renderAndReport = () => {
      render();
      reportDocumentHeight();
    };

    const unsubscribe = bridgeOn('view.context', (payload) => {
      currentContext = payload;
      renderAndReport();
    });

    if (needsContext) {
      // The host pushes context on mount/dom-ready, which can race ahead of this
      // subscription, so pull the current snapshot now that we are listening.
      void bridgeInvoke('view.getContext')
        .then((context) => {
          if (context != null && currentContext == null) {
            currentContext = context;
            renderAndReport();
          }
        })
        .catch(() => {});
    }

    renderAndReport();

    return () => {
      unsubscribe();
      resizeObserver?.disconnect();
      if (resizeFrame != null) {
        cancelAnimationFrame(resizeFrame);
      }
    };
  }

  if (slot === 'headerActions') {
    /**
     * Reports header action content size so the host webview matches the control.
     */
    const reportHeaderActionsSize = () => {
      const measureTarget = root.firstElementChild ?? root;
      const width = Math.ceil(
        Math.max(
          measureTarget.scrollWidth,
          measureTarget.getBoundingClientRect().width,
          measureTarget.offsetWidth
        )
      );
      const height = Math.ceil(
        Math.max(
          measureTarget.scrollHeight,
          measureTarget.getBoundingClientRect().height,
          measureTarget.offsetHeight
        )
      );
      if (width <= 0 && height <= 0) {
        return;
      }
      if (resizeFrame != null) {
        cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          void bridgeInvoke('view.reportSize', {
            ...(width > 0 ? { width } : {}),
            ...(height > 0 ? { height } : {}),
            slot: 'headerActions'
          });
        });
      });
    };

    resizeObserver = new ResizeObserver(() => {
      reportHeaderActionsSize();
    });
    resizeObserver.observe(root);

    render();
    reportHeaderActionsSize();

    return () => {
      resizeObserver?.disconnect();
      if (resizeFrame != null) {
        cancelAnimationFrame(resizeFrame);
      }
    };
  }

  const unsubscribe = bridgeOn('view.context', (payload) => {
    currentContext = payload;
    render();
  });

  if (needsContext) {
    // The host pushes context on mount/dom-ready, which can race ahead of this
    // subscription, so pull the current snapshot now that we are listening.
    void bridgeInvoke('view.getContext')
      .then((context) => {
        if (context != null && currentContext == null) {
          currentContext = context;
          render();
        }
      })
      .catch(() => {});
  }

  render();

  return () => {
    unsubscribe();
  };
}

export { getContributionComponent, getContributionHeaderActions };
