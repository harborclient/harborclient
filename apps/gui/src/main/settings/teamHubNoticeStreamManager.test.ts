import { describe, expect, it } from 'vitest';
import { computeNoticeStreamBackoffMs } from '#/main/settings/teamHubNoticeStreamManager';

describe('computeNoticeStreamBackoffMs', () => {
  it('doubles backoff until the configured cap', () => {
    expect(computeNoticeStreamBackoffMs(0)).toBe(1_000);
    expect(computeNoticeStreamBackoffMs(1)).toBe(2_000);
    expect(computeNoticeStreamBackoffMs(4)).toBe(16_000);
    expect(computeNoticeStreamBackoffMs(10)).toBe(30_000);
  });
});
