import { describe, expect, it } from 'vitest';
import { defaultShellLayout } from './defaultLayout';
import { MAIN_COLUMN_PANEL_ID } from './types';
import { withSidebarPlacement } from './withSidebarPlacement';

describe('withSidebarPlacement', () => {
  it('returns the same layout reference when placement is left', () => {
    expect(withSidebarPlacement(defaultShellLayout, 'left')).toBe(defaultShellLayout);
  });

  it('swaps primary and secondary sidebar zones when placement is right', () => {
    const right = withSidebarPlacement(defaultShellLayout, 'right');

    expect(right.main).toEqual([MAIN_COLUMN_PANEL_ID]);
    expect(right.primarySidebar).toEqual([
      'git-sidebar',
      'ai-sidebar',
      'shortcuts-sidebar',
      'live-server-logs-sidebar'
    ]);
    expect(right.secondarySidebar).toEqual(['collections-sidebar']);
    expect(defaultShellLayout.primarySidebar).toEqual(['collections-sidebar']);
  });
});
