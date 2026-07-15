import { describe, expect, it } from 'vitest';
import { pathHasParentSegment } from './pathHasParentSegment';

describe('pathHasParentSegment', () => {
  it('returns false when .. appears only inside a segment name', () => {
    expect(pathHasParentSegment('backup..2024/file.txt')).toBe(false);
    expect(pathHasParentSegment('/data/backup..2024/x')).toBe(false);
  });

  it('returns true for parent-directory traversal segments', () => {
    expect(pathHasParentSegment('foo/../bar')).toBe(true);
    expect(pathHasParentSegment('../escape')).toBe(true);
    expect(pathHasParentSegment('..')).toBe(true);
    expect(pathHasParentSegment('/a/../b')).toBe(true);
  });

  it('treats backslashes as path separators', () => {
    expect(pathHasParentSegment('foo\\..\\bar')).toBe(true);
    expect(pathHasParentSegment('foo\\backup..2024\\file.txt')).toBe(false);
  });
});
