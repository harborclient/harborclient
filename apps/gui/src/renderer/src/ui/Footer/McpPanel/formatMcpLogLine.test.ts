import { describe, expect, it } from 'vitest';
import { formatMcpLogLine } from './formatMcpLogLine';

describe('formatMcpLogLine', () => {
  it('formats HTTP access lines with direction and rpc method', () => {
    const line = formatMcpLogLine({
      id: 1,
      timestamp: Date.UTC(2026, 0, 1, 14, 20, 44, 810),
      direction: 'in',
      kind: 'http',
      method: 'POST',
      path: '/mcp',
      rpcMethod: 'initialize',
      statusCode: 200,
      durationMs: 3
    });
    expect(line).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] ← POST \/mcp initialize 200 3ms$/);
  });

  it('formats tool completion lines', () => {
    const line = formatMcpLogLine({
      id: 2,
      timestamp: Date.UTC(2026, 0, 1, 14, 20, 45, 33),
      direction: 'out',
      kind: 'tool',
      toolName: 'get_active_request',
      ok: true,
      durationMs: 12
    });
    expect(line).toContain('→ tool get_active_request ok 12ms');
  });

  it('formats lifecycle lines', () => {
    const line = formatMcpLogLine({
      id: 3,
      timestamp: Date.UTC(2026, 0, 1, 14, 20, 46, 0),
      direction: 'out',
      kind: 'lifecycle',
      rpcMethod: 'started',
      path: '127.0.0.1:7333'
    });
    expect(line).toContain('→ lifecycle started 127.0.0.1:7333');
  });
});
