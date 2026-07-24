import { describe, expect, it } from 'vitest';
import { rawUrlEncodedToRows, rowsToRawUrlEncoded } from './urlencodedRaw';

describe('rowsToRawUrlEncoded', () => {
  it('encodes enabled rows with non-empty keys', () => {
    expect(
      rowsToRawUrlEncoded([
        { key: 'a', value: '1', enabled: true },
        { key: 'b', value: 'two words', enabled: true }
      ])
    ).toBe('a=1&b=two+words');
  });

  it('skips disabled rows and blank keys', () => {
    expect(
      rowsToRawUrlEncoded([
        { key: 'a', value: '1', enabled: false },
        { key: '  ', value: 'x', enabled: true },
        { key: 'b', value: '', enabled: true }
      ])
    ).toBe('b=');
  });

  it('returns an empty string when there are no enabled rows', () => {
    expect(rowsToRawUrlEncoded([])).toBe('');
    expect(rowsToRawUrlEncoded([{ key: 'a', value: '1', enabled: false }])).toBe('');
  });

  it('preserves duplicate keys', () => {
    expect(
      rowsToRawUrlEncoded([
        { key: 'tag', value: 'a', enabled: true },
        { key: 'tag', value: 'b', enabled: true }
      ])
    ).toBe('tag=a&tag=b');
  });
});

describe('rawUrlEncodedToRows', () => {
  it('round-trips a simple encoded body', () => {
    const rows = rawUrlEncodedToRows('a=1&b=two+words');
    expect(rows).toEqual([
      { key: 'a', value: '1', enabled: true },
      { key: 'b', value: 'two words', enabled: true }
    ]);
  });

  it('returns an empty array for blank input', () => {
    expect(rawUrlEncodedToRows('')).toEqual([]);
  });

  it('preserves duplicate keys', () => {
    expect(rawUrlEncodedToRows('tag=a&tag=b')).toEqual([
      { key: 'tag', value: 'a', enabled: true },
      { key: 'tag', value: 'b', enabled: true }
    ]);
  });

  it('tolerates bare keys, missing values, and trailing separators without throwing', () => {
    expect(rawUrlEncodedToRows('alone&broken=&trailing&')).toEqual([
      { key: 'alone', value: '', enabled: true },
      { key: 'broken', value: '', enabled: true },
      { key: 'trailing', value: '', enabled: true }
    ]);
  });

  it('preserves undecodable percent sequences as literal text', () => {
    expect(rawUrlEncodedToRows('bad=%E0%A4%A')).toEqual([
      { key: 'bad', value: '%E0%A4%A', enabled: true }
    ]);
  });

  it('keeps values that contain extra equals signs', () => {
    expect(rawUrlEncodedToRows('expr=a=b=c')).toEqual([
      { key: 'expr', value: 'a=b=c', enabled: true }
    ]);
  });
});
