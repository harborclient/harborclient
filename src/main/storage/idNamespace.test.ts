import { describe, expect, it } from 'vitest';
import { decodeGlobalId, encodeGlobalId, ID_OFFSET } from '#/main/storage/idNamespace';

describe('idNamespace', () => {
  it('decodeGlobalId inverts encodeGlobalId for each backend slot', () => {
    expect(encodeGlobalId(0, 42)).toBe(42);
    expect(encodeGlobalId(2, 7)).toBe(2 * ID_OFFSET + 7);
    expect(decodeGlobalId(42)).toEqual({ slot: 0, localId: 42 });
    expect(decodeGlobalId(2 * ID_OFFSET + 7)).toEqual({ slot: 2, localId: 7 });
  });
});
