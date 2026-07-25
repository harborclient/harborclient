import { describe, expect, it } from 'vitest';
import {
  arrayOf,
  asRecord,
  bool,
  isRecord,
  num,
  numArray,
  oneOf,
  recordOf,
  str,
  strArray
} from './validate.js';

describe('isRecord', () => {
  it('accepts plain objects and rejects arrays and primitives', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});

describe('asRecord', () => {
  it('returns the record or null', () => {
    const value = { key: 'v' };
    expect(asRecord(value)).toBe(value);
    expect(asRecord(null)).toBeNull();
    expect(asRecord([1])).toBeNull();
  });
});

describe('str', () => {
  it('returns strings and falls back otherwise', () => {
    expect(str('hello', '')).toBe('hello');
    expect(str(42, 'fallback')).toBe('fallback');
    expect(str(undefined, null)).toBeNull();
  });
});

describe('num', () => {
  it('returns finite numbers and falls back otherwise', () => {
    expect(num(3, 0)).toBe(3);
    expect(num(NaN, 0)).toBe(0);
    expect(num(Infinity, 0)).toBe(0);
    expect(num('3', null)).toBeNull();
  });
});

describe('bool', () => {
  it('returns booleans and falls back otherwise', () => {
    expect(bool(true, false)).toBe(true);
    expect(bool(false, true)).toBe(false);
    expect(bool('true', true)).toBe(true);
  });
});

describe('oneOf', () => {
  it('accepts allowed literals and falls back otherwise', () => {
    expect(oneOf('delay', ['interval', 'delay'] as const, 'interval')).toBe('delay');
    expect(oneOf('other', ['interval', 'delay'] as const, 'interval')).toBe('interval');
    expect(oneOf(1, ['interval', 'delay'] as const, 'interval')).toBe('interval');
  });
});

describe('numArray', () => {
  it('filters to finite numbers', () => {
    expect(numArray([1, NaN, 2, 'x', Infinity])).toEqual([1, 2]);
    expect(numArray(null)).toEqual([]);
  });
});

describe('strArray', () => {
  it('filters to strings', () => {
    expect(strArray(['a', 1, 'b'])).toEqual(['a', 'b']);
    expect(strArray(undefined)).toEqual([]);
  });
});

describe('arrayOf', () => {
  it('filters through a guard', () => {
    const isNum = (entry: unknown): entry is number =>
      typeof entry === 'number' && Number.isFinite(entry);
    expect(arrayOf([1, 'x', 2], isNum)).toEqual([1, 2]);
    expect(arrayOf('nope', isNum)).toEqual([]);
  });
});

describe('recordOf', () => {
  it('keeps entries that pass the guard', () => {
    const isNum = (entry: unknown): entry is number =>
      typeof entry === 'number' && Number.isFinite(entry);
    expect(
      recordOf(
        {
          a: 1,
          b: 'x',
          c: 2
        },
        isNum
      )
    ).toEqual({ a: 1, c: 2 });
    expect(recordOf([], isNum)).toEqual({});
    expect(recordOf(null, isNum)).toEqual({});
  });
});
