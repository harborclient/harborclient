import { describe, expect, it, vi } from 'vitest';
import {
  createVerboseMcpClientFetch,
  describeMcpClientOutgoingRequest
} from './mcpClientVerboseFetch';

describe('describeMcpClientOutgoingRequest', () => {
  it('describes GET requests without JSON-RPC metadata', () => {
    expect(describeMcpClientOutgoingRequest('http://127.0.0.1:7333/mcp')).toEqual({
      httpMethod: 'GET',
      url: 'http://127.0.0.1:7333/mcp'
    });
  });

  it('extracts JSON-RPC method and session id from POST bodies', () => {
    expect(
      describeMcpClientOutgoingRequest('http://127.0.0.1:7333/mcp', {
        method: 'POST',
        headers: {
          'mcp-session-id': 'session-123'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        })
      })
    ).toEqual({
      httpMethod: 'POST',
      url: 'http://127.0.0.1:7333/mcp',
      jsonRpcMethod: 'tools/list',
      sessionId: 'session-123'
    });
  });
});

describe('createVerboseMcpClientFetch', () => {
  it('delegates to the underlying fetch implementation', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
    const verboseFetch = createVerboseMcpClientFetch(
      { serverId: 'server-1', name: 'Test MCP' },
      fetchImpl
    );

    const response = await verboseFetch('http://127.0.0.1:7333/mcp', { method: 'GET' });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:7333/mcp', { method: 'GET' });
  });
});
