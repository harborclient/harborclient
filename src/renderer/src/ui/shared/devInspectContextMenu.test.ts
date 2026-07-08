import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDevInspectMenuGroups,
  resolveInspectPoint,
  type InspectPoint
} from './devInspectContextMenu';

describe('resolveInspectPoint', () => {
  let querySelector: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    querySelector = vi.fn();
    vi.stubGlobal('window', {
      innerWidth: 800,
      innerHeight: 600
    });
    vi.stubGlobal('document', {
      querySelector
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the provided right-click point when available', () => {
    const point: InspectPoint = { x: 42, y: 84 };
    expect(resolveInspectPoint(point, 'request-1')).toEqual(point);
  });

  it('centers on the row actions trigger when no point was captured', () => {
    const trigger = {
      getBoundingClientRect: () =>
        ({
          left: 100,
          top: 200,
          width: 20,
          height: 20,
          right: 120,
          bottom: 220,
          x: 100,
          y: 200,
          toJSON: () => ({})
        }) as DOMRect
    };
    querySelector.mockReturnValueOnce(trigger);

    expect(resolveInspectPoint(undefined, 'request-1')).toEqual({ x: 110, y: 210 });
    expect(querySelector).toHaveBeenCalledWith(
      '.hc-row-actions-menu-trigger[aria-controls="request-1-menu"]'
    );
  });

  it('falls back to the viewport center when no trigger is found', () => {
    querySelector.mockReturnValue(null);

    expect(resolveInspectPoint(undefined, 'missing-menu')).toEqual({ x: 400, y: 300 });
  });
});

describe('buildDevInspectMenuGroups', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      api: {
        inspectElement: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty array when developer tools are disabled', () => {
    expect(buildDevInspectMenuGroups({ x: 1, y: 2 }, 'request-1', false)).toEqual([]);
  });

  it('returns an Inspect Element item when developer tools are enabled', () => {
    const groups = buildDevInspectMenuGroups({ x: 12, y: 34 }, 'request-9', true);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(1);
    expect(groups[0]?.[0]?.label).toBe('Inspect Element');

    groups[0]?.[0]?.onSelect();
    expect(window.api.inspectElement).toHaveBeenCalledWith(12, 34);
  });
});
