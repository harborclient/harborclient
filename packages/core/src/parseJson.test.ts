import { describe, expect, it } from 'vitest';
import { isPlainObject, parseJson } from './parseJson';

describe('parseJson', () => {
  it('returns the fallback for empty, null, or undefined input', () => {
    expect(parseJson('', { ok: true })).toEqual({ ok: true });
    expect(parseJson('   ', [])).toEqual([]);
    expect(parseJson(null, 1)).toBe(1);
    expect(parseJson(undefined, null)).toBeNull();
  });

  it('returns parsed JSON without asserting a caller type', () => {
    const parsed = parseJson('{"a":1}', null);
    expect(parsed).toEqual({ a: 1 });
  });

  it('returns the fallback when the string is not valid JSON', () => {
    expect(parseJson('{bad', [])).toEqual([]);
    expect(parseJson('undefined', null)).toBeNull();
  });
});

describe('isPlainObject', () => {
  it('accepts plain objects and rejects arrays, null, and primitives', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('x')).toBe(false);
    expect(isPlainObject(1)).toBe(false);
  });
});
