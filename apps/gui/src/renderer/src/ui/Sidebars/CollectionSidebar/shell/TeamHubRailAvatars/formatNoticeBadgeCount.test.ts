import { describe, expect, it } from 'vitest';
import { formatNoticeBadgeCount } from './formatNoticeBadgeCount';

describe('formatNoticeBadgeCount', () => {
  it('returns null for zero or negative counts', () => {
    expect(formatNoticeBadgeCount(0)).toBeNull();
    expect(formatNoticeBadgeCount(-1)).toBeNull();
  });

  it('returns the count as a string up to 99', () => {
    expect(formatNoticeBadgeCount(1)).toBe('1');
    expect(formatNoticeBadgeCount(99)).toBe('99');
  });

  it('caps counts above 99', () => {
    expect(formatNoticeBadgeCount(100)).toBe('99+');
    expect(formatNoticeBadgeCount(500)).toBe('99+');
  });
});
