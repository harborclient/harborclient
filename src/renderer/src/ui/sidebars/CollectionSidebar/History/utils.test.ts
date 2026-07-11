import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '#/renderer/src/ui/sidebars/CollectionSidebar/History/utils';

describe('formatRelativeTime', () => {
  it('returns just now for very recent timestamps', () => {
    expect(formatRelativeTime(Date.now() - 2_000, Date.now())).toBe('just now');
  });

  it('returns seconds ago for timestamps under one minute', () => {
    expect(formatRelativeTime(Date.now() - 30_000, Date.now())).toBe('30s ago');
  });

  it('returns minutes ago for timestamps under one hour', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000, Date.now())).toBe('5m ago');
  });
});
