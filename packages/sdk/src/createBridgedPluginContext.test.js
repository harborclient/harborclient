import { beforeEach, describe, expect, it, vi } from 'vitest';

const { bridgeInvoke, bridgeOn } = vi.hoisted(() => ({
  bridgeInvoke: vi.fn(async () => undefined),
  bridgeOn: vi.fn(() => () => {})
}));

vi.mock('./runtime/hcBridge.js', () => ({
  bridgeInvoke,
  bridgeOn
}));

vi.mock('./runtime/reactHost.js', () => ({
  setHostReact: vi.fn()
}));

vi.mock('./runtime/contributionRegistry.js', () => ({
  getContributionComponent: vi.fn(),
  getContributionHeaderActions: vi.fn(),
  registerContributionComponent: vi.fn(),
  registerContributionHeaderActions: vi.fn()
}));

vi.mock('./runtime/pluginDatabaseApi.js', () => ({
  createPluginDatabaseApi: vi.fn(() => ({}))
}));

const { createBridgedPluginContext, installImportInvokeListener, resetImportHandlersForTests } =
  await import('./runtime/createBridgedPluginContext.js');

/**
 * Builds a minimal manifest for bridged context tests.
 *
 * @returns {Record<string, unknown>} Plugin manifest.
 */
function createManifest(permissions = ['ui']) {
  return {
    id: 'com.example.test',
    permissions
  };
}

beforeEach(() => {
  bridgeInvoke.mockClear();
  bridgeOn.mockClear();
  resetImportHandlersForTests();
});

describe('createBridgedPluginContext imports', () => {
  it('exposes imports.registerHandler in agent mode and forwards registration to the broker', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest()
    });

    expect(hc.imports).toBeDefined();

    const handler = {
      canImport: () => true,
      import: async () => {}
    };
    const disposable = hc.imports.registerHandler(['.yaml', 'json'], handler);

    expect(bridgeInvoke).toHaveBeenCalledWith('imports.registerHandler', {
      registrationId: '1',
      extensions: ['.yaml', '.json']
    });

    disposable.dispose();
    expect(bridgeInvoke).toHaveBeenCalledWith('imports.unregisterHandler', {
      registrationId: '1'
    });
  });

  it('returns a no-op disposable for imports.registerHandler in view mode', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'view',
      contributionId: 'panel',
      react: {},
      manifest: createManifest()
    });

    const disposable = hc.imports.registerHandler('.json', {
      canImport: () => true,
      import: async () => {}
    });

    expect(bridgeInvoke).not.toHaveBeenCalled();
    expect(() => disposable.dispose()).not.toThrow();
  });
});

describe('installImportInvokeListener', () => {
  it('runs canImport and import handlers and reports results to the broker', async () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest()
    });

    const canImport = vi.fn(() => true);
    const importFn = vi.fn(async () => {});
    hc.imports.registerHandler('.yaml', { canImport, import: importFn });

    /** @type {(payload: unknown) => void | Promise<void>} */
    let invokeListener;
    bridgeOn.mockImplementation((channel, listener) => {
      if (channel === 'imports.invoke') {
        invokeListener = listener;
      }
      return () => {};
    });

    installImportInvokeListener();

    const file = {
      name: 'petstore.yaml',
      path: '/tmp/petstore.yaml',
      extension: '.yaml',
      contents: 'openapi: 3.0.3'
    };

    await invokeListener?.({
      requestId: 7,
      registrationId: '1',
      phase: 'canImport',
      file
    });

    expect(canImport).toHaveBeenCalledWith(file);
    expect(bridgeInvoke).toHaveBeenCalledWith('imports.invokeComplete', {
      requestId: 7,
      ok: true,
      result: true
    });

    await invokeListener?.({
      requestId: 8,
      registrationId: '1',
      phase: 'import',
      file
    });

    expect(importFn).toHaveBeenCalledWith(file);
    expect(bridgeInvoke).toHaveBeenCalledWith('imports.invokeComplete', {
      requestId: 8,
      ok: true,
      result: undefined
    });
  });
});

describe('createBridgedPluginContext mcp', () => {
  it('forwards MCP server registration to the broker in agent mode', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest(['mcp'])
    });

    const disposable = hc.mcp.registerServer({
      name: 'WordPress',
      serverURL: 'https://public-api.wordpress.com/wpcom/v2/mcp/v1/',
      enabled: true,
      headers: [{ key: 'Authorization', value: 'token' }]
    });

    expect(bridgeInvoke).toHaveBeenCalledWith('mcp.registerServer', {
      registrationId: '1',
      name: 'WordPress',
      serverURL: 'https://public-api.wordpress.com/wpcom/v2/mcp/v1',
      enabled: true,
      headers: [{ key: 'Authorization', value: 'token' }],
      icon: undefined
    });

    disposable.dispose();
    expect(bridgeInvoke).toHaveBeenCalledWith('mcp.unregisterServer', {
      registrationId: '1'
    });
  });

  it('returns a no-op disposable for MCP registration in view mode', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'view',
      contributionId: 'panel',
      react: {},
      manifest: createManifest(['mcp'])
    });

    const disposable = hc.mcp.registerServer({
      name: 'WordPress',
      serverURL: 'https://example.com/mcp'
    });

    expect(bridgeInvoke).not.toHaveBeenCalled();
    expect(() => disposable.dispose()).not.toThrow();
  });

  it('throws when the plugin lacks the mcp permission', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest(['ui'])
    });

    expect(() =>
      hc.mcp.registerServer({
        name: 'WordPress',
        serverURL: 'https://example.com/mcp'
      })
    ).toThrow('lacks permission: mcp');
  });
});

describe('createBridgedPluginContext ai', () => {
  it('forwards chat pointer registration and copyToChat in agent mode', async () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest(['ai'])
    });

    const disposable = hc.ai.registerChatPointer({
      id: 'script',
      agentGuidance: 'Use captured script context.'
    });

    expect(bridgeInvoke).toHaveBeenCalledWith('ai.registerChatPointer', {
      registrationId: '1',
      pointerId: 'script',
      agentGuidance: 'Use captured script context.'
    });

    await hc.ai.copyToChat({
      pointerId: 'script',
      key: 'abc',
      label: 'My Script',
      context: 'console.log(1)',
      selection: { start: 0, end: 4 }
    });

    expect(bridgeInvoke).toHaveBeenCalledWith('ai.copyToChat', {
      pointerId: 'script',
      key: 'abc',
      label: 'My Script',
      context: 'console.log(1)',
      selection: { start: 0, end: 4 }
    });

    disposable.dispose();
    expect(bridgeInvoke).toHaveBeenCalledWith('ai.unregisterChatPointer', {
      registrationId: '1'
    });
  });

  it('rejects invalid chat pointer ids', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest(['ai'])
    });

    expect(() => hc.ai.registerChatPointer({ id: 'Bad_Id' })).toThrow(/Invalid chat pointer id/);
  });
});

describe('createBridgedPluginContext subscription auto-tracking', () => {
  it('auto-appends registration disposables to hc.subscriptions', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest()
    });

    expect(hc.subscriptions).toHaveLength(0);

    const disposable = hc.imports.registerHandler('.json', {
      canImport: () => true,
      import: async () => {}
    });

    expect(hc.subscriptions).toHaveLength(1);
    expect(hc.subscriptions[0]).toBe(disposable);
  });

  it('disposes only once when dispose is called repeatedly', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest(['mcp'])
    });

    const disposable = hc.mcp.registerServer({
      name: 'WordPress',
      serverURL: 'https://example.com/mcp'
    });

    bridgeInvoke.mockClear();
    disposable.dispose();
    disposable.dispose();

    expect(bridgeInvoke).toHaveBeenCalledTimes(1);
    expect(bridgeInvoke).toHaveBeenCalledWith('mcp.unregisterServer', {
      registrationId: '1'
    });
    expect(hc.subscriptions).toHaveLength(0);
  });

  it('does not double-unregister when using the legacy subscriptions.push pattern', () => {
    const hc = createBridgedPluginContext({
      pluginId: 'com.example.test',
      mode: 'agent',
      react: {},
      manifest: createManifest(['mcp'])
    });

    const disposable = hc.mcp.registerServer({
      name: 'WordPress',
      serverURL: 'https://example.com/mcp'
    });
    hc.subscriptions.push(disposable);

    expect(hc.subscriptions).toHaveLength(2);

    bridgeInvoke.mockClear();
    disposable.dispose();

    expect(bridgeInvoke).toHaveBeenCalledTimes(1);
    expect(bridgeInvoke).toHaveBeenCalledWith('mcp.unregisterServer', {
      registrationId: '1'
    });

    // Legacy duplicate entry remains but dispose is a no-op.
    expect(hc.subscriptions).toHaveLength(1);
    disposable.dispose();
    expect(bridgeInvoke).toHaveBeenCalledTimes(1);
  });
});
