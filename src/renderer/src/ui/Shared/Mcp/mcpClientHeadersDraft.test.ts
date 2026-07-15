import { describe, expect, it } from 'vitest';
import {
  formatMcpClientHeadersDraft,
  parseMcpClientHeadersDraft
} from '#/renderer/src/ui/Shared/Mcp/mcpClientHeadersDraft';

describe('mcpClientHeadersDraft', () => {
  it('formatMcpClientHeadersDraft returns [] for empty headers', () => {
    expect(formatMcpClientHeadersDraft([])).toBe('[]');
  });

  it('formatMcpClientHeadersDraft emits single-key objects', () => {
    expect(
      formatMcpClientHeadersDraft([
        { key: 'Authorization', value: 'Bearer token' },
        { key: 'x-api-key', value: 'abc' }
      ])
    ).toBe(JSON.stringify([{ Authorization: 'Bearer token' }, { 'x-api-key': 'abc' }], null, 2));
  });

  it('parseMcpClientHeadersDraft treats blank draft as empty headers', () => {
    expect(parseMcpClientHeadersDraft('')).toEqual({ ok: true, headers: [] });
    expect(parseMcpClientHeadersDraft('   ')).toEqual({ ok: true, headers: [] });
  });

  it('parseMcpClientHeadersDraft accepts single-key-object rows', () => {
    expect(
      parseMcpClientHeadersDraft('[{"Authorization":"Bearer token"},{"x-api-key":"abc"}]')
    ).toEqual({
      ok: true,
      headers: [
        { key: 'Authorization', value: 'Bearer token' },
        { key: 'x-api-key', value: 'abc' }
      ]
    });
  });

  it('parseMcpClientHeadersDraft still accepts legacy key/value rows', () => {
    expect(parseMcpClientHeadersDraft('[{"key":"Authorization","value":"Bearer token"}]')).toEqual({
      ok: true,
      headers: [{ key: 'Authorization', value: 'Bearer token' }]
    });
  });

  it('parseMcpClientHeadersDraft rejects invalid JSON', () => {
    const result = parseMcpClientHeadersDraft('[{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Headers must be valid JSON.');
    }
  });

  it('parseMcpClientHeadersDraft rejects non-array JSON', () => {
    const result = parseMcpClientHeadersDraft('{"Authorization":"Bearer token"}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Headers must be a JSON array.');
    }
  });

  it('parseMcpClientHeadersDraft rejects objects with multiple keys', () => {
    const result = parseMcpClientHeadersDraft('[{"a":"1","b":"2"}]');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('exactly one header name');
    }
  });
});
