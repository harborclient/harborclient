import { describe, expect, it } from 'vitest';
import type { WebContents } from 'electron';
import {
  DEFAULT_ZOOM_FACTOR,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  roundZoomFactor,
  resetZoom,
  stepZoomIn,
  stepZoomOut
} from '#/main/window/zoom';

/**
 * Returns a mock web contents object with a mutable zoom factor.
 *
 * @param factor - Initial zoom factor.
 */
function mockWebContents(factor: number): WebContents & { zoomFactor: number } {
  return { zoomFactor: factor } as WebContents & { zoomFactor: number };
}

describe('roundZoomFactor', () => {
  it('rounds to one decimal place', () => {
    expect(roundZoomFactor(1.04)).toBe(1);
    expect(roundZoomFactor(1.05)).toBe(1.1);
  });
});

describe('stepZoomIn', () => {
  it('increases zoom factor by one step', () => {
    const webContents = mockWebContents(1);

    stepZoomIn(webContents);

    expect(webContents.zoomFactor).toBe(1.1);
  });

  it('does not exceed the maximum zoom factor', () => {
    const webContents = mockWebContents(MAX_ZOOM_FACTOR);

    stepZoomIn(webContents);

    expect(webContents.zoomFactor).toBe(MAX_ZOOM_FACTOR);
  });
});

describe('stepZoomOut', () => {
  it('decreases zoom factor by one step', () => {
    const webContents = mockWebContents(1);

    stepZoomOut(webContents);

    expect(webContents.zoomFactor).toBe(0.9);
  });

  it('does not go below the minimum zoom factor', () => {
    const webContents = mockWebContents(MIN_ZOOM_FACTOR);

    stepZoomOut(webContents);

    expect(webContents.zoomFactor).toBe(MIN_ZOOM_FACTOR);
  });
});

describe('resetZoom', () => {
  it('restores the default zoom factor', () => {
    const webContents = mockWebContents(1.5);

    resetZoom(webContents);

    expect(webContents.zoomFactor).toBe(DEFAULT_ZOOM_FACTOR);
  });
});
