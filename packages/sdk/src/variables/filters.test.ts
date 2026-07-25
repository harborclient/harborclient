import { describe, expect, it } from 'vitest';
import { FILTERS, applyFilters } from './filters.js';

describe('FILTERS', () => {
  it('uppercases values', () => {
    expect(FILTERS.upper('hello', [])).toBe('HELLO');
  });

  it('lowercases values', () => {
    expect(FILTERS.lower('HELLO', [])).toBe('hello');
  });

  it('url-encodes values', () => {
    expect(FILTERS.urlencode('a b&c', [])).toBe('a%20b%26c');
  });

  it('trims surrounding whitespace', () => {
    expect(FILTERS.trim('  hello  ', [])).toBe('hello');
  });

  it('returns string length', () => {
    expect(FILTERS.length('hello', [])).toBe('5');
  });

  it('strips HTML tags', () => {
    expect(FILTERS.striptags('<p>hello</p>', [])).toBe('hello');
  });

  it('capitalizes the first character and lowercases the rest', () => {
    expect(FILTERS.capitalize('hELLO', [])).toBe('Hello');
  });

  it('rounds numeric values', () => {
    expect(FILTERS.round('3.7', [])).toBe('4');
  });

  it('leaves non-numeric values unchanged for round', () => {
    expect(FILTERS.round('abc', [])).toBe('abc');
  });
});

describe('applyFilters', () => {
  it('applies a single filter', () => {
    expect(applyFilters('hello', [{ name: 'upper', args: [] }])).toBe('HELLO');
  });

  it('chains filters left-to-right', () => {
    expect(
      applyFilters('  hello  ', [
        { name: 'trim', args: [] },
        { name: 'upper', args: [] }
      ])
    ).toBe('HELLO');
  });

  it('returns null for unknown filters', () => {
    expect(applyFilters('hello', [{ name: 'unknown', args: [] }])).toBeNull();
  });

  it('returns the original value when the filter list is empty', () => {
    expect(applyFilters('hello', [])).toBe('hello');
  });
});
