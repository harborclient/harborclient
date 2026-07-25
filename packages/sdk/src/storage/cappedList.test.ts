import { describe, expect, it } from 'vitest';
import { mergeById } from './cappedList.js';

describe('mergeById', () => {
  it('dedupes and caps newest-first', () => {
    const merged = mergeById([{ id: 'b' }, { id: 'a' }], [{ id: 'a' }, { id: 'c' }], {
      cap: 3,
      idOf: (entry: { id: string }) => entry.id
    });
    expect(merged.map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
  });
});
