import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';

const { mockGetPersistedZoomFactor, mockSetPersistedZoomFactor } = vi.hoisted(() => ({
  mockGetPersistedZoomFactor: vi.fn(),
  mockSetPersistedZoomFactor: vi.fn()
}));

vi.mock('#/main/settings/zoomSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/main/settings/zoomSettings')>();
  return {
    ...actual,
    getPersistedZoomFactor: mockGetPersistedZoomFactor,
    setPersistedZoomFactor: mockSetPersistedZoomFactor
  };
});

import {
  DEFAULT_ZOOM_FACTOR,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  roundZoomFactor,
  applyZoomFactorPreview,
  resetZoom,
  restoreZoomFactor,
  setZoomFactor,
  stepZoomIn,
  stepZoomOut
} from './zoom';

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
  beforeEach(() => {
    mockSetPersistedZoomFactor.mockReset();
  });

  it('increases zoom factor by one step', () => {
    const webContents = mockWebContents(1);

    stepZoomIn(webContents);

    expect(webContents.zoomFactor).toBe(1.1);
    expect(mockSetPersistedZoomFactor).toHaveBeenCalledWith(1.1);
  });

  it('does not exceed the maximum zoom factor', () => {
    const webContents = mockWebContents(MAX_ZOOM_FACTOR);

    stepZoomIn(webContents);

    expect(webContents.zoomFactor).toBe(MAX_ZOOM_FACTOR);
    expect(mockSetPersistedZoomFactor).toHaveBeenCalledWith(MAX_ZOOM_FACTOR);
  });
});

describe('stepZoomOut', () => {
  beforeEach(() => {
    mockSetPersistedZoomFactor.mockReset();
  });

  it('decreases zoom factor by one step', () => {
    const webContents = mockWebContents(1);

    stepZoomOut(webContents);

    expect(webContents.zoomFactor).toBe(0.9);
    expect(mockSetPersistedZoomFactor).toHaveBeenCalledWith(0.9);
  });

  it('does not go below the minimum zoom factor', () => {
    const webContents = mockWebContents(MIN_ZOOM_FACTOR);

    stepZoomOut(webContents);

    expect(webContents.zoomFactor).toBe(MIN_ZOOM_FACTOR);
    expect(mockSetPersistedZoomFactor).toHaveBeenCalledWith(MIN_ZOOM_FACTOR);
  });
});

describe('resetZoom', () => {
  beforeEach(() => {
    mockSetPersistedZoomFactor.mockReset();
  });

  it('restores the default zoom factor', () => {
    const webContents = mockWebContents(1.5);

    resetZoom(webContents);

    expect(webContents.zoomFactor).toBe(DEFAULT_ZOOM_FACTOR);
    expect(mockSetPersistedZoomFactor).toHaveBeenCalledWith(DEFAULT_ZOOM_FACTOR);
  });
});

describe('restoreZoomFactor', () => {
  beforeEach(() => {
    mockGetPersistedZoomFactor.mockReset();
    mockSetPersistedZoomFactor.mockReset();
  });

  it('applies the persisted zoom factor', () => {
    mockGetPersistedZoomFactor.mockReturnValue(0.8);
    const webContents = mockWebContents(1);

    restoreZoomFactor(webContents);

    expect(webContents.zoomFactor).toBe(0.8);
    expect(mockSetPersistedZoomFactor).toHaveBeenCalledWith(0.8);
  });
});

describe('applyZoomFactorPreview', () => {
  beforeEach(() => {
    mockSetPersistedZoomFactor.mockReset();
  });

  it('applies zoom without persisting it', () => {
    const webContents = mockWebContents(1);

    applyZoomFactorPreview(webContents, 0.9);

    expect(webContents.zoomFactor).toBe(0.9);
    expect(mockSetPersistedZoomFactor).not.toHaveBeenCalled();
  });
});

describe('setZoomFactor', () => {
  beforeEach(() => {
    mockSetPersistedZoomFactor.mockReset();
  });

  it('applies and persists the zoom factor', () => {
    const webContents = mockWebContents(1);

    setZoomFactor(webContents, 1.1);

    expect(webContents.zoomFactor).toBe(1.1);
    expect(mockSetPersistedZoomFactor).toHaveBeenCalledWith(1.1);
  });
});
