import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import {
  DEFAULT_MCP_SERVER_SETTINGS,
  deleteMcpClientServer,
  ensureMcpServerToken,
  generateMcpServerToken,
  getMcpServerSettings,
  isValidMcpServerToken,
  listEffectiveMcpClientServers,
  listMcpClientServers,
  regenerateMcpServerToken,
  saveMcpClientServer,
  setMcpServerSettings
} from './mcpSettings';
import {
  buildPluginMcpServerId,
  registerPluginMcpServer,
  resetPluginMcpRegistryForTests
} from '#/main/plugins/pluginMcpRegistry';

describe('mcpSettings', () => {
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    settingsStore = {};
    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalDatabase;
    setLocalDatabaseForTesting(database);
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
    resetPluginMcpRegistryForTests();
  });

  it('returns defaults when unset', () => {
    expect(getMcpServerSettings()).toEqual(DEFAULT_MCP_SERVER_SETTINGS);
  });

  it('generates a non-empty bearer token', () => {
    expect(generateMcpServerToken().length).toBeGreaterThan(20);
  });

  it('persists and reloads MCP server settings', () => {
    setMcpServerSettings({
      enabled: true,
      host: '0.0.0.0',
      port: 8088,
      token: 'secret-token',
      exposedTools: ['list_collections']
    });

    expect(getMcpServerSettings()).toEqual({
      enabled: true,
      host: '0.0.0.0',
      port: 8088,
      token: 'secret-token',
      exposedTools: ['list_collections']
    });
  });

  it('regenerates the MCP server token', () => {
    setMcpServerSettings({
      ...DEFAULT_MCP_SERVER_SETTINGS,
      token: 'old-token'
    });

    const regenerated = regenerateMcpServerToken();
    expect(regenerated.token).not.toBe('old-token');
    expect(getMcpServerSettings().token).toBe(regenerated.token);
  });

  it('ensures a token when enabling the server', () => {
    const next = ensureMcpServerToken({
      ...DEFAULT_MCP_SERVER_SETTINGS,
      enabled: true,
      token: ''
    });
    expect(next.token.length).toBeGreaterThan(0);
  });

  it('validates bearer tokens with constant-time comparison', () => {
    setMcpServerSettings({
      ...DEFAULT_MCP_SERVER_SETTINGS,
      token: 'valid-token'
    });

    expect(isValidMcpServerToken('valid-token')).toBe(true);
    expect(isValidMcpServerToken('wrong-token')).toBe(false);
  });

  it('creates MCP client servers with generated ids', () => {
    const saved = saveMcpClientServer({
      id: '',
      name: ' Docs ',
      url: 'http://127.0.0.1:3000/mcp/',
      headers: [{ key: ' Authorization ', value: 'Bearer x' }],
      enabled: true
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('Docs');
    expect(saved[0]?.url).toBe('http://127.0.0.1:3000/mcp');
    expect(saved[0]?.headers).toEqual([{ key: 'Authorization', value: 'Bearer x' }]);
    expect(saved[0]?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(listMcpClientServers()).toEqual(saved);
  });

  it('deletes MCP client servers by id', () => {
    const created = saveMcpClientServer({
      id: '',
      name: 'One',
      url: 'http://127.0.0.1:3000/mcp',
      headers: [],
      enabled: true
    });
    const id = created[0]?.id ?? '';
    expect(deleteMcpClientServer(id)).toEqual([]);
  });

  it('merges user and plugin MCP client servers for settings display', () => {
    saveMcpClientServer({
      id: '',
      name: 'Docs',
      url: 'http://127.0.0.1:3000/mcp',
      headers: [],
      enabled: true
    });
    registerPluginMcpServer('com.example.wordpress', '1', {
      name: 'WordPress',
      serverURL: 'https://example.com/mcp'
    });

    const servers = listEffectiveMcpClientServers();
    expect(servers).toHaveLength(2);
    expect(servers[0]).toMatchObject({
      name: 'Docs',
      source: 'user',
      readonly: false
    });
    expect(servers[1]).toMatchObject({
      name: 'WordPress',
      source: 'plugin',
      readonly: true,
      pluginId: 'com.example.wordpress'
    });
  });

  it('rejects saving or deleting plugin-owned MCP client servers', () => {
    const pluginId = buildPluginMcpServerId('com.example.wordpress', '1');

    expect(() =>
      saveMcpClientServer({
        id: pluginId,
        name: 'WordPress',
        url: 'https://example.com/mcp',
        headers: [],
        enabled: true
      })
    ).toThrow('Plugin-provided MCP client servers cannot be modified from settings.');

    expect(() => deleteMcpClientServer(pluginId)).toThrow(
      'Plugin-provided MCP client servers cannot be deleted from settings.'
    );
  });
});
