import { describe, expect, it } from 'vitest';
import { isAnyFooterPanelOpen } from './useBrowserGuestFooterCover';

describe('isAnyFooterPanelOpen', () => {
  it('is false when every footer panel is closed', () => {
    expect(isAnyFooterPanelOpen(false, false, false, false, null, false, false)).toBe(false);
  });

  it('is true when any built-in or plugin panel is open', () => {
    expect(isAnyFooterPanelOpen(true, false, false, false, null, false, false)).toBe(true);
    expect(isAnyFooterPanelOpen(false, true, false, false, null, false, false)).toBe(true);
    expect(isAnyFooterPanelOpen(false, false, true, false, null, false, false)).toBe(true);
    expect(isAnyFooterPanelOpen(false, false, false, true, null, false, false)).toBe(true);
    expect(isAnyFooterPanelOpen(false, false, false, false, 'plugin.panel', false, false)).toBe(
      true
    );
    expect(isAnyFooterPanelOpen(false, false, false, false, null, true, false)).toBe(true);
    expect(isAnyFooterPanelOpen(false, false, false, false, null, false, true)).toBe(true);
    expect(isAnyFooterPanelOpen(false, false, false, false, null, false, false, true)).toBe(true);
  });
});
