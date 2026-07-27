import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mapPluginSurfaceToHostViewport,
  showEntityContextMenuForPlugin,
  validateEntityContextMenuTarget
} from './hostEntityContextMenu';
import {
  clearPluginEntityContextMenuSubscribers,
  subscribePluginEntityContextMenuOpen
} from './pluginEntityContextMenuBus';

beforeEach(() => {
  clearPluginEntityContextMenuSubscribers();
});

afterEach(() => {
  clearPluginEntityContextMenuSubscribers();
});

describe('validateEntityContextMenuTarget', () => {
  it('accepts collection, folder, and request targets', () => {
    expect(validateEntityContextMenuTarget({ type: 'collection', collectionId: 1 })).toEqual({
      type: 'collection',
      collectionId: 1
    });
    expect(
      validateEntityContextMenuTarget({ type: 'folder', collectionId: 1, folderId: 2 })
    ).toEqual({ type: 'folder', collectionId: 1, folderId: 2 });
    expect(validateEntityContextMenuTarget({ type: 'request', requestId: 3 })).toEqual({
      type: 'request',
      requestId: 3
    });
  });

  it('rejects invalid targets', () => {
    expect(() => validateEntityContextMenuTarget(null)).toThrow(/target object/);
    expect(() => validateEntityContextMenuTarget({ type: 'document', id: 1 })).toThrow(
      /collection.*folder.*request/
    );
    expect(() => validateEntityContextMenuTarget({ type: 'collection' })).toThrow(/collectionId/);
  });
});

describe('mapPluginSurfaceToHostViewport', () => {
  it('offsets webview-local coordinates by the HostedSurface bounding rect', () => {
    const container = {
      getBoundingClientRect: () => ({ left: 100, top: 50, right: 400, bottom: 600 })
    };
    const documentRef = {
      querySelector: vi.fn().mockReturnValue(container)
    } as unknown as ParentNode;

    expect(mapPluginSurfaceToHostViewport('com.example', 'panel', 12, 34, documentRef)).toEqual({
      x: 112,
      y: 84
    });
    expect(documentRef.querySelector).toHaveBeenCalled();
  });

  it('falls back to the input coordinates when the surface is missing', () => {
    const documentRef = {
      querySelector: vi.fn().mockReturnValue(null)
    } as unknown as ParentNode;

    expect(mapPluginSurfaceToHostViewport('com.example', 'panel', 12, 34, documentRef)).toEqual({
      x: 12,
      y: 34
    });
  });
});

describe('showEntityContextMenuForPlugin', () => {
  it('validates input, maps coordinates, and emits on the bus', () => {
    const listener = vi.fn();
    subscribePluginEntityContextMenuOpen(listener);

    const container = {
      getBoundingClientRect: () => ({ left: 10, top: 20, right: 100, bottom: 200 })
    };
    const querySelector = vi.fn().mockReturnValue(container);
    vi.stubGlobal('document', { querySelector });

    showEntityContextMenuForPlugin({
      target: { type: 'request', requestId: 9 },
      x: 5,
      y: 7,
      pluginId: 'com.example.tree',
      contributionId: 'collections'
    });

    expect(listener).toHaveBeenCalledWith({
      target: { type: 'request', requestId: 9 },
      anchor: { x: 15, y: 27 },
      pluginId: 'com.example.tree',
      contributionId: 'collections'
    });

    vi.unstubAllGlobals();
  });

  it('throws when pluginId or coordinates are invalid', () => {
    expect(() =>
      showEntityContextMenuForPlugin({
        target: { type: 'collection', collectionId: 1 },
        x: 0,
        y: 0,
        pluginId: '',
        contributionId: 'collections'
      })
    ).toThrow(/pluginId/);

    expect(() =>
      showEntityContextMenuForPlugin({
        target: { type: 'collection', collectionId: 1 },
        x: Number.NaN,
        y: 0,
        pluginId: 'com.example',
        contributionId: 'collections'
      })
    ).toThrow(/numeric x/);
  });
});
