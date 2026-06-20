import { describe, expect, it } from 'vitest';
import { fitWindowStateToDisplays, type SavedWindowState } from '#/main/window/windowState';
import type { Display } from 'electron';

function display(workArea: Display['workArea']): Display {
  return { workArea } as Display;
}

describe('fitWindowStateToDisplays', () => {
  const primary = display({ x: 0, y: 0, width: 1920, height: 1040 });
  const secondary = display({ x: 1920, y: 0, width: 1920, height: 1040 });

  it('keeps bounds that fit on a connected display', () => {
    const state: SavedWindowState = {
      x: 1980,
      y: 107,
      width: 1652,
      height: 892,
      isMaximized: false,
      isFullScreen: false
    };

    expect(fitWindowStateToDisplays(state, [primary, secondary])).toEqual(state);
  });

  it('recenters on the nearest display instead of resetting to defaults', () => {
    const state: SavedWindowState = {
      x: 1980,
      y: 107,
      width: 1652,
      height: 892,
      isMaximized: true,
      isFullScreen: false
    };

    const fitted = fitWindowStateToDisplays(state, [primary]);

    expect(fitted.width).toBe(1652);
    expect(fitted.height).toBe(892);
    expect(fitted.isMaximized).toBe(false);
    expect(fitted.x).toBeGreaterThanOrEqual(0);
    expect(fitted.y).toBeGreaterThanOrEqual(0);
    expect(fitted.x + fitted.width).toBeLessThanOrEqual(1920);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(1040);
  });
});
