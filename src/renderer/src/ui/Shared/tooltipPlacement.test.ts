import { describe, expect, it } from 'vitest';
import {
  buildFixedTooltipPosition,
  resolveTooltipPlacement,
  TOOLTIP_ANCHOR_GAP_PX
} from './tooltipPlacement';

describe('resolveTooltipPlacement', () => {
  const anchorRect = {
    top: 100,
    bottom: 120,
    left: 0,
    right: 0,
    width: 0,
    height: 20,
    x: 0,
    y: 100,
    toJSON: () => ({})
  } as DOMRect;

  it('prefers below when there is enough space under the anchor', () => {
    expect(
      resolveTooltipPlacement(anchorRect, 80, { top: 0, bottom: 300 }, TOOLTIP_ANCHOR_GAP_PX)
    ).toBe('below');
  });

  it('places above when there is more space above than below', () => {
    expect(
      resolveTooltipPlacement(anchorRect, 80, { top: 0, bottom: 150 }, TOOLTIP_ANCHOR_GAP_PX)
    ).toBe('above');
  });

  it('keeps below when both sides are tight but below has more room', () => {
    expect(
      resolveTooltipPlacement(anchorRect, 120, { top: 90, bottom: 140 }, TOOLTIP_ANCHOR_GAP_PX)
    ).toBe('below');
  });
});

describe('buildFixedTooltipPosition', () => {
  const anchorRect = {
    top: 100,
    bottom: 120,
    left: 16,
    right: 0,
    width: 0,
    height: 20,
    x: 16,
    y: 100,
    toJSON: () => ({})
  } as DOMRect;

  it('positions below the anchor with the configured gap', () => {
    expect(buildFixedTooltipPosition(anchorRect, 'below', TOOLTIP_ANCHOR_GAP_PX)).toEqual({
      left: 16,
      top: 124
    });
  });

  it('positions above the anchor with the configured gap', () => {
    expect(buildFixedTooltipPosition(anchorRect, 'above', TOOLTIP_ANCHOR_GAP_PX)).toEqual({
      left: 16,
      top: 96
    });
  });
});
