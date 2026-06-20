import { describe, expect, it } from 'vitest';
import {
  emptyUrlEncodedPart,
  normalizeUrlEncodedPart,
  parseUrlEncodedParts,
  serializeUrlEncodedParts
} from '#/shared/urlencoded';

describe('parseUrlEncodedParts', () => {
  it('returns an empty array for blank or invalid JSON', () => {
    expect(parseUrlEncodedParts('')).toEqual([]);
    expect(parseUrlEncodedParts('   ')).toEqual([]);
    expect(parseUrlEncodedParts('not-json')).toEqual([]);
    expect(parseUrlEncodedParts('{"key":"value"}')).toEqual([]);
  });

  it('normalizes partial records', () => {
    const rows = parseUrlEncodedParts(
      JSON.stringify([
        { key: 'name', value: 'Ada', enabled: true },
        { key: 'disabled', value: 'off', enabled: false },
        { enabled: true }
      ])
    );

    expect(rows).toEqual([
      { key: 'name', value: 'Ada', enabled: true },
      { key: 'disabled', value: 'off', enabled: false },
      { key: '', value: '', enabled: true }
    ]);
  });
});

describe('serializeUrlEncodedParts', () => {
  it('returns an empty string when there are no rows', () => {
    expect(serializeUrlEncodedParts([])).toBe('');
  });

  it('serializeUrlEncodedParts output parses back via parseUrlEncodedParts', () => {
    const rows = [
      emptyUrlEncodedPart(),
      { key: 'title', value: '{{name}}', enabled: true },
      { key: 'skip', value: 'me', enabled: false }
    ];

    expect(parseUrlEncodedParts(serializeUrlEncodedParts(rows))).toEqual(
      rows.map(normalizeUrlEncodedPart)
    );
  });
});

describe('emptyUrlEncodedPart', () => {
  it('returns a blank enabled row', () => {
    expect(emptyUrlEncodedPart()).toEqual({ key: '', value: '', enabled: true });
  });
});
