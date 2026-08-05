import { describe, expect, it } from 'vitest';
import {
  USER_REGEX_MAX_LENGTH,
  assertSafeUserRegexSource,
  isSafeUserRegexSource
} from './safeUserRegex.js';

describe('isSafeUserRegexSource', () => {
  it('accepts simple and invoice-style patterns', () => {
    expect(isSafeUserRegexSource('a+')).toBe(true);
    expect(isSafeUserRegexSource('\\d+')).toBe(true);
    expect(isSafeUserRegexSource('^/docs/')).toBe(true);
    expect(isSafeUserRegexSource('invoice\\.([A-Za-z0-9-]+)(?:#(\\d+)\\.(\\d+))?')).toBe(true);
  });

  it('rejects empty, invalid, nested-quantifier, and over-long sources', () => {
    expect(isSafeUserRegexSource('')).toBe(false);
    expect(isSafeUserRegexSource('   ')).toBe(false);
    expect(isSafeUserRegexSource('(unclosed')).toBe(false);
    expect(isSafeUserRegexSource('(a+)+')).toBe(false);
    expect(isSafeUserRegexSource('([a-z]*)*')).toBe(false);
    expect(isSafeUserRegexSource('a'.repeat(USER_REGEX_MAX_LENGTH + 1))).toBe(false);
    expect(isSafeUserRegexSource('a'.repeat(USER_REGEX_MAX_LENGTH))).toBe(true);
  });

  it('rejects sources with too many unbounded quantifiers', () => {
    const dense = Array.from({ length: 11 }, () => 'a+').join('');
    expect(isSafeUserRegexSource(dense)).toBe(false);
  });
});

describe('assertSafeUserRegexSource', () => {
  it('throws clear errors for unsafe patterns', () => {
    expect(() => assertSafeUserRegexSource('')).toThrow(/empty/i);
    expect(() => assertSafeUserRegexSource('(a+)+')).toThrow(/unsafe|nested/i);
    expect(() => assertSafeUserRegexSource('a'.repeat(USER_REGEX_MAX_LENGTH + 1))).toThrow(
      /at most/i
    );
    expect(() => assertSafeUserRegexSource('(unclosed')).toThrow(/invalid/i);
  });

  it('accepts safe patterns without throwing', () => {
    expect(() => assertSafeUserRegexSource('\\d+')).not.toThrow();
    expect(() =>
      assertSafeUserRegexSource('invoice\\.([A-Za-z0-9-]+)(?:#(\\d+)\\.(\\d+))?')
    ).not.toThrow();
  });
});
