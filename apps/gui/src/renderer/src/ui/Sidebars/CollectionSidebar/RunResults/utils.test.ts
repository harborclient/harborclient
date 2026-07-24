import { describe, expect, it } from 'vitest';
import { formatRunResultRowDate } from './utils';

describe('formatRunResultRowDate', () => {
  it('formats an ISO timestamp as YYYY-MM-DD HH:MM:SS in UTC', () => {
    expect(formatRunResultRowDate('2026-07-11T14:23:03.000Z')).toBe('2026-07-11 14:23:03');
  });
});
