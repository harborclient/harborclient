import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { DEFAULT_MCP_SERVER_SETTINGS } from '#/main/settings/mcpSettings';
import {
  appendMcpServerLog,
  listMcpServerLogs,
  readMcpJsonRpcMethod,
  sanitizeMcpServerLogError
} from './mcpServerLogBuffer';

const getMcpServerSettingsMock = vi.hoisted(() => vi.fn(() => DEFAULT_MCP_SERVER_SETTINGS));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => []
  }
}));

vi.mock('#/main/settings/mcpSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/main/settings/mcpSettings')>();
  return {
    ...actual,
    getMcpServerSettings: () => getMcpServerSettingsMock()
  };
});

describe('mcpServerLogBuffer', () => {
  let logs: Array<Parameters<LocalDatabase['appendMcpServerLog']>[0] & { id: number }>;
  let nextId: number;

  beforeEach(() => {
    logs = [];
    nextId = 1;
    getMcpServerSettingsMock.mockReturnValue(DEFAULT_MCP_SERVER_SETTINGS);
    const database = {
      appendMcpServerLog: (entry: Parameters<LocalDatabase['appendMcpServerLog']>[0]) => {
        const inserted = { ...entry, id: nextId++ };
        logs.push(inserted);
        return inserted;
      },
      listMcpServerLogs: () => logs
    } as unknown as LocalDatabase;
    setLocalDatabaseForTesting(database);
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
  });

  it('redacts bearer tokens and authorization fragments from errors', () => {
    expect(sanitizeMcpServerLogError('Bearer abc.def.ghi failed')).toBe('[redacted] failed');
    expect(sanitizeMcpServerLogError('Authorization: secret-value boom')).toBe('[redacted] boom');
    expect(sanitizeMcpServerLogError('token=super-secret oops')).toBe('[redacted] oops');
  });

  it('reads JSON-RPC method names without touching params', () => {
    expect(readMcpJsonRpcMethod({ method: 'tools/call', params: { secret: 'x' } })).toBe(
      'tools/call'
    );
    expect(readMcpJsonRpcMethod(null)).toBeUndefined();
  });

  it('does not append when keepLogs is disabled', () => {
    getMcpServerSettingsMock.mockReturnValue({
      ...DEFAULT_MCP_SERVER_SETTINGS,
      keepLogs: false
    });
    expect(
      appendMcpServerLog({
        timestamp: Date.now(),
        direction: 'in',
        kind: 'http',
        method: 'POST',
        path: '/mcp'
      })
    ).toBeNull();
    expect(listMcpServerLogs()).toEqual([]);
  });

  it('appends sanitized entries when keepLogs is enabled', () => {
    getMcpServerSettingsMock.mockReturnValue({
      ...DEFAULT_MCP_SERVER_SETTINGS,
      keepLogs: true,
      token: 'secret-token'
    });

    const entry = appendMcpServerLog({
      timestamp: 1234,
      direction: 'out',
      kind: 'tool',
      toolName: 'list_collections',
      ok: false,
      error: 'Bearer leaked-token failed'
    });

    expect(entry).toMatchObject({
      id: 1,
      toolName: 'list_collections',
      ok: false,
      error: '[redacted] failed'
    });
    expect(listMcpServerLogs()).toHaveLength(1);
  });
});
