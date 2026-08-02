// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HELP_TIP_TRIGGER_GAP_PX, getHelpTipPosition } from './helpTipPosition.js';

/**
 * Builds a DOMRect-like object for positioning tests.
 *
 * @param top - Trigger top edge.
 * @param left - Trigger left edge.
 * @param size - Trigger width and height.
 */
function rect(top: number, left: number, size = 20): DOMRect {
  return {
    top,
    left,
    bottom: top + size,
    right: left + size,
    width: size,
    height: size,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect;
}

describe('getHelpTipPosition', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('places the tip above the icon when there is enough space', () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);

    const tipSize = { width: 360, height: 140 };
    const trigger = rect(300, 100);
    const position = getHelpTipPosition(trigger, tipSize);

    expect(position.y).toBe(trigger.top - HELP_TIP_TRIGGER_GAP_PX - tipSize.height);
    expect(position.x).toBe(trigger.left);
  });

  it('falls back below the icon when there is not enough space above', () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);

    const tipSize = { width: 360, height: 140 };
    const trigger = rect(40, 100);
    const position = getHelpTipPosition(trigger, tipSize);

    expect(position.y).toBe(trigger.bottom + HELP_TIP_TRIGGER_GAP_PX);
    expect(position.x).toBe(trigger.left);
  });
});
