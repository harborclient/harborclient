import { describe, expect, it } from 'vitest';
import { progressFillPercent } from './progressBar.logic.js';

describe('progressFillPercent', () => {
  it('returns rounded percentage for partial progress', () => {
    expect(progressFillPercent(3, 10)).toBe(30);
  });

  it('returns 0 when max is zero', () => {
    expect(progressFillPercent(5, 0)).toBe(0);
  });

  it('returns 100 when value equals max', () => {
    expect(progressFillPercent(10, 10)).toBe(100);
  });
});
