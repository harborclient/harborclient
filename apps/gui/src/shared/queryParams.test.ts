import { describe, expect, it } from 'vitest';
import { applyParamsToUrl, mergeParamsFromUrl, parseQueryString, splitUrl } from './queryParams';

describe('splitUrl', () => {
  it('splits base, query, and hash without re-encoding', () => {
    expect(splitUrl('https://httpbin.org/post?test=foo#section')).toEqual({
      base: 'https://httpbin.org/post',
      query: 'test=foo',
      hash: 'section'
    });
  });

  it('handles URLs without query or hash', () => {
    expect(splitUrl('https://httpbin.org/post')).toEqual({
      base: 'https://httpbin.org/post',
      query: '',
      hash: ''
    });
  });

  it('handles root-relative paths', () => {
    expect(splitUrl('/api?x=1')).toEqual({
      base: '/api',
      query: 'x=1',
      hash: ''
    });
  });
});

describe('parseQueryString', () => {
  it('parses basic query params', () => {
    expect(parseQueryString('https://httpbin.org/post?test=foo')).toEqual([
      { key: 'test', value: 'foo', enabled: true }
    ]);
  });

  it('parses multiple params and key-only segments', () => {
    expect(parseQueryString('https://example.com?a=1&flag&b=two')).toEqual([
      { key: 'a', value: '1', enabled: true },
      { key: 'flag', value: '', enabled: true },
      { key: 'b', value: 'two', enabled: true }
    ]);
  });

  it('preserves {{variables}} without decoding', () => {
    expect(parseQueryString('https://example.com?token={{tok}}&name={{user}}')).toEqual([
      { key: 'token', value: '{{tok}}', enabled: true },
      { key: 'name', value: '{{user}}', enabled: true }
    ]);
  });

  it('returns an empty array when there is no query string', () => {
    expect(parseQueryString('https://example.com/path')).toEqual([]);
  });
});

describe('applyParamsToUrl', () => {
  it('writes enabled params into the query string', () => {
    const url = 'https://httpbin.org/post';
    const params = [
      { key: 'test', value: 'foo', enabled: true },
      { key: '', value: '', enabled: true }
    ];

    expect(applyParamsToUrl(url, params)).toBe('https://httpbin.org/post?test=foo');
  });

  it('replaces an existing query string and preserves the hash', () => {
    const url = 'https://example.com/old?removed=1#frag';
    const params = [{ key: 'new', value: 'value', enabled: true }];

    expect(applyParamsToUrl(url, params)).toBe('https://example.com/old?new=value#frag');
  });

  it('omits disabled and empty-key rows from the query string', () => {
    const url = 'https://example.com';
    const params = [
      { key: 'active', value: 'yes', enabled: true },
      { key: 'hidden', value: 'no', enabled: false },
      { key: '', value: 'ignored', enabled: true }
    ];

    expect(applyParamsToUrl(url, params)).toBe('https://example.com?active=yes');
  });

  it('strips the query string when no enabled params remain', () => {
    const url = 'https://example.com/path?old=1#keep';
    const params = [
      { key: 'old', value: '1', enabled: false },
      { key: '', value: '', enabled: true }
    ];

    expect(applyParamsToUrl(url, params)).toBe('https://example.com/path#keep');
  });

  it('preserves {{variables}} in rebuilt URLs', () => {
    const url = 'https://example.com';
    const params = [{ key: 'token', value: '{{tok}}', enabled: true }];

    expect(applyParamsToUrl(url, params)).toBe('https://example.com?token={{tok}}');
  });

  it('handles root-relative paths', () => {
    const url = '/api';
    const params = [{ key: 'x', value: '1', enabled: true }];

    expect(applyParamsToUrl(url, params)).toBe('/api?x=1');
  });
});

describe('mergeParamsFromUrl', () => {
  it('parses URL params and appends a trailing blank row', () => {
    expect(mergeParamsFromUrl('https://httpbin.org/post?test=foo', [])).toEqual([
      { key: 'test', value: 'foo', enabled: true },
      { key: '', value: '', enabled: true }
    ]);
  });

  it('retains disabled non-empty rows from the current table', () => {
    const currentParams = [
      { key: 'old', value: 'kept', enabled: false },
      { key: '', value: '', enabled: true }
    ];

    expect(mergeParamsFromUrl('https://example.com?new=1', currentParams)).toEqual([
      { key: 'new', value: '1', enabled: true },
      { key: 'old', value: 'kept', enabled: false },
      { key: '', value: '', enabled: true }
    ]);
  });

  it('returns a single blank row for URLs without query params', () => {
    expect(mergeParamsFromUrl('https://example.com', [])).toEqual([
      { key: '', value: '', enabled: true }
    ]);
  });
});

describe('round-trip stability', () => {
  it('applyParamsToUrl and parseQueryString preserve enabled params', () => {
    const url = 'https://example.com/base?ignored=1#frag';
    const params = [
      { key: 'a', value: '1', enabled: true },
      { key: 'b', value: '{{var}}', enabled: true },
      { key: 'off', value: 'x', enabled: false },
      { key: '', value: '', enabled: true }
    ];

    const rebuilt = applyParamsToUrl(url, params);
    expect(rebuilt).toBe('https://example.com/base?a=1&b={{var}}#frag');
    expect(parseQueryString(rebuilt)).toEqual([
      { key: 'a', value: '1', enabled: true },
      { key: 'b', value: '{{var}}', enabled: true }
    ]);
  });
});
