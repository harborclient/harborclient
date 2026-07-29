import { describe, expect, it } from 'vitest';
import type { RegisteredSidebarRailItem } from '@harborclient/core/plugin/types';
import type { SidebarRailItemData } from '@harborclient/sdk/components';
import { faBolt, faFolder, faPuzzlePiece } from '#/renderer/src/fontawesome';
import {
  mergeSidebarRailItems,
  resolveActiveSidebarRailItem,
  resolveSidebarChromeVisibility
} from './sidebarRailResolution';

/**
 * Builds a registered rail item for resolution tests.
 *
 * @param overrides - Partial fields to merge onto defaults.
 * @returns A complete registered rail item.
 */
function railItem(
  overrides: Partial<RegisteredSidebarRailItem> & Pick<RegisteredSidebarRailItem, 'id'>
): RegisteredSidebarRailItem {
  return {
    pluginId: 'com.example.plugin',
    title: 'Tools',
    icon: 'bolt',
    contributionId: 'tools',
    ...overrides
  };
}

describe('resolveActiveSidebarRailItem', () => {
  it('returns null when no id is active', () => {
    expect(
      resolveActiveSidebarRailItem([railItem({ id: 'plugin:com.example.plugin:tools' })], null)
    ).toBeNull();
  });

  it('returns the matching registered item', () => {
    const item = railItem({ id: 'plugin:com.example.plugin:tools' });
    expect(resolveActiveSidebarRailItem([item], item.id)).toBe(item);
  });

  it('returns null for a stale id', () => {
    expect(
      resolveActiveSidebarRailItem(
        [railItem({ id: 'plugin:com.example.plugin:tools' })],
        'plugin:com.example.plugin:gone'
      )
    ).toBeNull();
  });
});

describe('mergeSidebarRailItems', () => {
  const builtIn: SidebarRailItemData[] = [
    { id: 'collections', icon: faFolder, label: 'Collections' }
  ];

  it('appends plugin items after built-ins with resolved icons', () => {
    const merged = mergeSidebarRailItems(
      builtIn,
      [
        railItem({ id: 'plugin:a:first', title: 'First', order: 5, icon: 'bolt' }),
        railItem({ id: 'plugin:a:later', title: 'Later', order: 20 })
      ],
      (name) => (name === 'bolt' ? faBolt : faPuzzlePiece)
    );

    expect(merged.map((item) => item.id)).toEqual([
      'collections',
      'plugin:a:first',
      'plugin:a:later'
    ]);
    expect(merged[1]?.label).toBe('First');
    expect(merged[1]?.icon).toBe(faBolt);
  });

  it('falls back through the icon resolver for unknown names', () => {
    const merged = mergeSidebarRailItems(
      builtIn,
      [railItem({ id: 'plugin:a:x', icon: 'not-real' })],
      () => faPuzzlePiece
    );
    expect(merged[1]?.icon).toBe(faPuzzlePiece);
  });
});

describe('resolveSidebarChromeVisibility', () => {
  it('shows search and rail for the built-in accordion', () => {
    expect(resolveSidebarChromeVisibility(false, false)).toEqual({
      showSearch: true,
      showRail: true
    });
  });

  it('hides chrome for switcher sidebar panels', () => {
    expect(resolveSidebarChromeVisibility(true, false)).toEqual({
      showSearch: false,
      showRail: false
    });
  });

  it('keeps the rail for plugin rail items and hides search', () => {
    expect(resolveSidebarChromeVisibility(false, true)).toEqual({
      showSearch: false,
      showRail: true
    });
  });

  it('prefers rail-item chrome when both flags are set', () => {
    expect(resolveSidebarChromeVisibility(true, true)).toEqual({
      showSearch: false,
      showRail: true
    });
  });
});
