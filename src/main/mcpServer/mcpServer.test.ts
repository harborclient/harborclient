import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { getMcpServerStatus, startMcpServer, stopMcpServer } from '#/main/mcpServer/mcpServer';
import { DEFAULT_MCP_SERVER_SETTINGS, setMcpServerSettings } from '#/main/settings/mcpSettings';

const TEST_TOKEN = 'test-mcp-token';

const MCP_HEADERS = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream'
} as const;

/**
 * Builds the MCP server URL for the currently running listener.
 */
function getMcpUrl(): string {
  const status = getMcpServerStatus();
  if (!status.running || status.port == null) {
    throw new Error('MCP server is not running.');
  }

  const host = status.host ?? '127.0.0.1';
  return `http://${host}:${status.port}/mcp`;
}

/**
 * Parses an MCP HTTP response body as JSON or SSE event data.
 *
 * @param response - Fetch response from an MCP endpoint.
 */
async function parseMcpResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    const dataLines = text
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice('data: '.length));
    const lastData = dataLines.at(-1);
    if (!lastData) {
      throw new Error('MCP SSE response did not include JSON data.');
    }
    return JSON.parse(lastData) as unknown;
  }

  return response.json() as Promise<unknown>;
}

/**
 * Starts an MCP session via initialize and returns the assigned session id.
 */
async function initializeMcpSession(): Promise<string> {
  const response = await fetch(getMcpUrl(), {
    method: 'POST',
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    })
  });

  expect(response.ok).toBe(true);
  const sessionId = response.headers.get('mcp-session-id');
  expect(sessionId).toBeTruthy();
  return sessionId!;
}

describe('mcpServer HTTP routes', () => {
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

    setMcpServerSettings({
      ...DEFAULT_MCP_SERVER_SETTINGS,
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      token: TEST_TOKEN,
      exposedTools: ['list_collections']
    });
  });

  afterEach(async () => {
    await stopMcpServer();
    clearLocalDatabaseForTesting();
  });

  it('returns 400 for GET /mcp without a session id', async () => {
    await startMcpServer({
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      token: TEST_TOKEN,
      exposedTools: ['list_collections']
    });

    const response = await fetch(getMcpUrl(), {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`
      }
    });

    expect(response.status).toBe(400);
  });

  it('returns 401 for GET /mcp without a bearer token', async () => {
    await startMcpServer({
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      token: TEST_TOKEN,
      exposedTools: ['list_collections']
    });

    const response = await fetch(getMcpUrl());

    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      error?: { code?: number; message?: string };
    };
    expect(body.error?.code).toBe(-32001);
    expect(body.error?.message).toBe('Unauthorized');
  });

  it('accepts POST /mcp initialize requests and returns a session id', async () => {
    await startMcpServer({
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      token: TEST_TOKEN,
      exposedTools: ['list_collections']
    });

    const sessionId = await initializeMcpSession();
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it('lists exposed tools for an initialized session', async () => {
    await startMcpServer({
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      token: TEST_TOKEN,
      exposedTools: ['list_collections']
    });

    const sessionId = await initializeMcpSession();

    const response = await fetch(getMcpUrl(), {
      method: 'POST',
      headers: {
        ...MCP_HEADERS,
        'mcp-session-id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    });

    expect(response.ok).toBe(true);
    const body = (await parseMcpResponseBody(response)) as {
      result?: { tools?: Array<{ name?: string }> };
    };
    const toolNames = body.result?.tools?.map((tool) => tool.name) ?? [];
    expect(toolNames).toContain('list_collections');
  });

  it('opens an SSE stream for GET /mcp with a valid session id', async () => {
    await startMcpServer({
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      token: TEST_TOKEN,
      exposedTools: ['list_collections']
    });

    const sessionId = await initializeMcpSession();
    const controller = new AbortController();

    const response = await fetch(getMcpUrl(), {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
        Accept: 'text/event-stream',
        'mcp-session-id': sessionId
      },
      signal: controller.signal
    });

    expect(response.status).not.toBe(404);
    expect(response.status).not.toBe(405);
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    controller.abort();
  });
});
