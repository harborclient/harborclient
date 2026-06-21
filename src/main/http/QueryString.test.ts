import { describe, expect, it } from 'vitest';
import { QueryString } from '#/main/http/QueryString';

describe('QueryString', () => {
  const queryString = new QueryString();

  describe('buildUrl', () => {
    it('returns trimmed URL when empty or whitespace', () => {
      expect(queryString.buildUrl('', [])).toBe('');
      expect(queryString.buildUrl('   ', [])).toBe('');
    });

    it('returns URL unchanged when no enabled params', () => {
      expect(queryString.buildUrl('https://example.com', [])).toBe('https://example.com');
      expect(
        queryString.buildUrl('https://example.com', [
          { key: 'q', value: 'test', enabled: false },
          { key: '  ', value: 'ignored', enabled: true }
        ])
      ).toBe('https://example.com');
    });

    it('appends and overwrites params on a valid absolute URL', () => {
      const url = queryString.buildUrl('https://example.com/path?existing=1', [
        { key: 'foo', value: 'bar', enabled: true },
        { key: 'existing', value: '2', enabled: true }
      ]);

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://example.com/path');
      expect(parsed.searchParams.get('existing')).toBe('2');
      expect(parsed.searchParams.get('foo')).toBe('bar');
    });

    it('skips disabled and blank-key params', () => {
      const url = queryString.buildUrl('https://example.com', [
        { key: 'enabled', value: 'yes', enabled: true },
        { key: 'disabled', value: 'no', enabled: false },
        { key: '   ', value: 'blank', enabled: true }
      ]);

      const parsed = new URL(url);
      expect(parsed.searchParams.get('enabled')).toBe('yes');
      expect(parsed.searchParams.has('disabled')).toBe(false);
      expect(parsed.searchParams.has('blank')).toBe(false);
    });

    it('uses fallback query building for non-absolute URLs', () => {
      expect(queryString.buildUrl('/api/users', [{ key: 'page', value: '2', enabled: true }])).toBe(
        '/api/users?page=2'
      );
      expect(
        queryString.buildUrl('/api/users?sort=name', [{ key: 'page', value: '2', enabled: true }])
      ).toBe('/api/users?sort=name&page=2');
      expect(
        queryString.buildUrl('/search', [{ key: 'q', value: 'hello world', enabled: true }])
      ).toBe('/search?q=hello%20world');
    });

    it('does not append params to disallowed schemes or malformed URLs', () => {
      const params = [{ key: 'q', value: 'test', enabled: true }];

      expect(queryString.buildUrl('javascript:alert(1)', params)).toBe('javascript:alert(1)');
      expect(queryString.buildUrl('file:///', params)).toBe('file:///');
      expect(queryString.buildUrl('not-a-url', params)).toBe('not-a-url');
      expect(queryString.buildUrl('//cdn.example.com/path', params)).toBe('//cdn.example.com/path');
    });
  });

  describe('isValidRequestUrl', () => {
    it('accepts http and https absolute URLs', () => {
      expect(queryString.isValidRequestUrl('https://example.com')).toBe(true);
      expect(queryString.isValidRequestUrl('http://localhost:8080/path')).toBe(true);
    });

    it('accepts root-relative paths', () => {
      expect(queryString.isValidRequestUrl('/api/users')).toBe(true);
      expect(queryString.isValidRequestUrl('/search?q=hello')).toBe(true);
    });

    it('rejects blank, dangerous, and malformed URLs', () => {
      expect(queryString.isValidRequestUrl('')).toBe(false);
      expect(queryString.isValidRequestUrl('   ')).toBe(false);
      expect(queryString.isValidRequestUrl('javascript:alert(1)')).toBe(false);
      expect(queryString.isValidRequestUrl('file:///')).toBe(false);
      expect(queryString.isValidRequestUrl('not-a-url')).toBe(false);
      expect(queryString.isValidRequestUrl('//cdn.example.com/path')).toBe(false);
    });
  });
});
