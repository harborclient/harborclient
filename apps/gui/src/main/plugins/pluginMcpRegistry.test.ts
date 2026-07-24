import { beforeEach, describe, expect, it } from 'vitest';
import type { PluginManager } from './PluginManager';
import {
  buildPluginMcpServerId,
  clearPluginMcpServers,
  isPluginMcpServerId,
  listPluginMcpClientServers,
  registerPluginMcpServer,
  resetPluginMcpRegistryForTests,
  setPluginMcpRegistryManager,
  unregisterPluginMcpServer
} from './pluginMcpRegistry';

describe('pluginMcpRegistry', () => {
  beforeEach(() => {
    resetPluginMcpRegistryForTests();
    setPluginMcpRegistryManager({
      get: (pluginId: string) =>
        pluginId === 'com.example.wordpress'
          ? {
              manifest: { name: 'WordPress' }
            }
          : undefined
    } as unknown as PluginManager);
  });

  it('builds stable plugin-owned MCP server ids', () => {
    expect(buildPluginMcpServerId('com.example.wordpress', '1')).toBe(
      'plugin:com.example.wordpress:1'
    );
    expect(isPluginMcpServerId('plugin:com.example.wordpress:1')).toBe(true);
    expect(isPluginMcpServerId('user-uuid')).toBe(false);
  });

  it('registers plugin MCP servers with attribution metadata', () => {
    registerPluginMcpServer('com.example.wordpress', '1', {
      name: 'WordPress',
      serverURL: 'https://example.com/mcp/',
      enabled: true,
      headers: [{ key: 'Authorization', value: 'token' }],
      icon: 'data:image/png;base64,abc'
    });

    expect(listPluginMcpClientServers()).toEqual([
      {
        id: 'plugin:com.example.wordpress:1',
        name: 'WordPress',
        url: 'https://example.com/mcp',
        headers: [{ key: 'Authorization', value: 'token' }],
        enabled: true,
        source: 'plugin',
        pluginId: 'com.example.wordpress',
        pluginName: 'WordPress',
        icon: 'data:image/png;base64,abc',
        readonly: true
      }
    ]);
  });

  it('replaces registrations with the same plugin and registration id', () => {
    registerPluginMcpServer('com.example.wordpress', '1', {
      name: 'Old',
      serverURL: 'https://old.example/mcp'
    });
    registerPluginMcpServer('com.example.wordpress', '1', {
      name: 'New',
      serverURL: 'https://new.example/mcp'
    });

    expect(listPluginMcpClientServers()).toHaveLength(1);
    expect(listPluginMcpClientServers()[0]?.name).toBe('New');
  });

  it('unregisters and clears plugin-owned MCP servers', () => {
    registerPluginMcpServer('com.example.wordpress', '1', {
      name: 'WordPress',
      serverURL: 'https://example.com/mcp'
    });
    registerPluginMcpServer('com.example.wordpress', '2', {
      name: 'Other',
      serverURL: 'https://other.example/mcp'
    });

    unregisterPluginMcpServer('com.example.wordpress', '1');
    expect(listPluginMcpClientServers()).toHaveLength(1);

    clearPluginMcpServers('com.example.wordpress');
    expect(listPluginMcpClientServers()).toEqual([]);
  });
});
