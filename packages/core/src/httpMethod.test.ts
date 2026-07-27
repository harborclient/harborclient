import { describe, expect, it } from 'vitest';
import { compareHttpMethods, HTTP_METHOD_SORT_ORDER, parseHttpMethod } from './httpMethod';

describe('parseHttpMethod', () => {
  it('accepts supported methods with normalization', () => {
    expect(parseHttpMethod('get')).toBe('GET');
    expect(parseHttpMethod(' Post ')).toBe('POST');
    expect(parseHttpMethod('OPTIONS')).toBe('OPTIONS');
  });

  it('returns null for unsupported or invalid values', () => {
    expect(parseHttpMethod('TRACE')).toBeNull();
    expect(parseHttpMethod('')).toBeNull();
    expect(parseHttpMethod('   ')).toBeNull();
    expect(parseHttpMethod(null)).toBeNull();
    expect(parseHttpMethod(undefined)).toBeNull();
  });
});

describe('HTTP_METHOD_SORT_ORDER', () => {
  it('lists methods in the canonical ascending order', () => {
    expect(HTTP_METHOD_SORT_ORDER).toEqual([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS'
    ]);
  });
});

describe('compareHttpMethods', () => {
  it('orders methods ascending GET through OPTIONS', () => {
    expect(compareHttpMethods('GET', 'POST', 'asc')).toBeLessThan(0);
    expect(compareHttpMethods('POST', 'PUT', 'asc')).toBeLessThan(0);
    expect(compareHttpMethods('PUT', 'PATCH', 'asc')).toBeLessThan(0);
    expect(compareHttpMethods('PATCH', 'DELETE', 'asc')).toBeLessThan(0);
    expect(compareHttpMethods('DELETE', 'HEAD', 'asc')).toBeLessThan(0);
    expect(compareHttpMethods('HEAD', 'OPTIONS', 'asc')).toBeLessThan(0);
    expect(compareHttpMethods('OPTIONS', 'GET', 'asc')).toBeGreaterThan(0);
  });

  it('orders methods descending as the reverse of ascending', () => {
    expect(compareHttpMethods('OPTIONS', 'HEAD', 'desc')).toBeLessThan(0);
    expect(compareHttpMethods('DELETE', 'GET', 'desc')).toBeLessThan(0);
    expect(compareHttpMethods('GET', 'OPTIONS', 'desc')).toBeGreaterThan(0);
  });

  it('returns 0 for equal known methods so callers can tie-break', () => {
    expect(compareHttpMethods('POST', 'POST', 'asc')).toBe(0);
    expect(compareHttpMethods('post', 'POST', 'desc')).toBe(0);
  });

  it('sorts unknown or missing methods after known methods', () => {
    expect(compareHttpMethods(null, 'GET', 'asc')).toBeGreaterThan(0);
    expect(compareHttpMethods('TRACE', 'OPTIONS', 'asc')).toBeGreaterThan(0);
    expect(compareHttpMethods('GET', undefined, 'asc')).toBeLessThan(0);
    expect(compareHttpMethods(null, 'TRACE', 'asc')).toBe(0);
    expect(compareHttpMethods(null, 'GET', 'desc')).toBeGreaterThan(0);
    expect(compareHttpMethods('OPTIONS', undefined, 'desc')).toBeLessThan(0);
  });
});
