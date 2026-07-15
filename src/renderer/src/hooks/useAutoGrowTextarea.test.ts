import { describe, expect, it } from 'vitest';
import {
  COMPOSER_MAX_HEIGHT_PX,
  COMPOSER_MIN_HEIGHT_PX,
  computeAutoGrowHeight
} from './useAutoGrowTextarea';

describe('computeAutoGrowHeight', () => {
  it('uses the minimum height when content is shorter than the starting size', () => {
    expect(computeAutoGrowHeight(40, COMPOSER_MIN_HEIGHT_PX, COMPOSER_MAX_HEIGHT_PX)).toEqual({
      heightPx: COMPOSER_MIN_HEIGHT_PX,
      overflowY: 'hidden'
    });
  });

  it('matches measured height when content fits between min and max', () => {
    expect(computeAutoGrowHeight(120, COMPOSER_MIN_HEIGHT_PX, COMPOSER_MAX_HEIGHT_PX)).toEqual({
      heightPx: 120,
      overflowY: 'hidden'
    });
  });

  it('caps height at the maximum and enables scrolling when content exceeds it', () => {
    expect(computeAutoGrowHeight(400, COMPOSER_MIN_HEIGHT_PX, COMPOSER_MAX_HEIGHT_PX)).toEqual({
      heightPx: COMPOSER_MAX_HEIGHT_PX,
      overflowY: 'auto'
    });
  });
});
