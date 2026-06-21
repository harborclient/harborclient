import { describe, expect, it } from 'vitest';
import { Headers } from '#/main/http/Headers';

describe('Headers', () => {
  const headersBuilder = new Headers();

  describe('build', () => {
    it('includes only enabled headers with trimmed keys', () => {
      const result = headersBuilder.build(
        [
          { key: ' Authorization ', value: 'Bearer token', enabled: true },
          { key: 'X-Disabled', value: 'off', enabled: false },
          { key: '  ', value: 'blank', enabled: true }
        ],
        'none'
      );

      expect(result).toEqual({ ok: true, headers: { Authorization: 'Bearer token' } });
    });

    it('auto-adds application/json Content-Type for json body', () => {
      expect(headersBuilder.build([], 'json')).toEqual({
        ok: true,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('auto-adds text/plain Content-Type for text body', () => {
      expect(headersBuilder.build([], 'text')).toEqual({
        ok: true,
        headers: { 'Content-Type': 'text/plain' }
      });
    });

    it('does not auto-add Content-Type for none body', () => {
      expect(headersBuilder.build([], 'none')).toEqual({ ok: true, headers: {} });
    });

    it('respects an existing case-insensitive content-type header', () => {
      const result = headersBuilder.build(
        [{ key: 'content-type', value: 'application/xml', enabled: true }],
        'json'
      );

      expect(result).toEqual({ ok: true, headers: { 'content-type': 'application/xml' } });
    });

    it('strips content-type for multipart body so fetch can set the boundary', () => {
      const result = headersBuilder.build(
        [
          { key: 'Content-Type', value: 'multipart/form-data', enabled: true },
          { key: 'Authorization', value: 'Bearer token', enabled: true }
        ],
        'multipart'
      );

      expect(result).toEqual({ ok: true, headers: { Authorization: 'Bearer token' } });
    });

    it('does not auto-add Content-Type for multipart body', () => {
      expect(headersBuilder.build([], 'multipart')).toEqual({ ok: true, headers: {} });
    });

    it('auto-adds application/x-www-form-urlencoded Content-Type for urlencoded body', () => {
      expect(headersBuilder.build([], 'urlencoded')).toEqual({
        ok: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    });

    it('respects an existing content-type header for urlencoded body', () => {
      const result = headersBuilder.build(
        [{ key: 'Content-Type', value: 'text/plain', enabled: true }],
        'urlencoded'
      );

      expect(result).toEqual({ ok: true, headers: { 'Content-Type': 'text/plain' } });
    });

    it('request headers override collection headers when merged last-wins', () => {
      const collectionHeaders = [
        { key: 'Authorization', value: 'Bearer collection', enabled: true }
      ];
      const requestHeaders = [{ key: 'Authorization', value: 'Bearer request', enabled: true }];
      const merged = [...collectionHeaders, ...requestHeaders];

      expect(headersBuilder.build(merged, 'none')).toEqual({
        ok: true,
        headers: { Authorization: 'Bearer request' }
      });
    });

    it('rejects hop-by-hop headers', () => {
      const result = headersBuilder.build(
        [{ key: 'Connection', value: 'close', enabled: true }],
        'none'
      );

      expect(result).toEqual({ ok: false, error: 'Forbidden header: Connection' });
    });

    it('rejects header values containing CRLF', () => {
      const result = headersBuilder.build(
        [{ key: 'X-Test', value: 'safe\r\nX-Injected: evil', enabled: true }],
        'none'
      );

      expect(result).toEqual({
        ok: false,
        error: 'Invalid header value for "X-Test": control characters are not allowed'
      });
    });
  });
});
