import { describe, expect, it } from 'vitest';
import { isAnyFooterPanelOpen, shouldCoverBrowserGuest } from './useBrowserGuestOverlayCover';

describe('isAnyFooterPanelOpen', () => {
  it('is false when every footer panel is closed', () => {
    expect(isAnyFooterPanelOpen(false, false, false, false, null)).toBe(false);
  });

  it('is true when any built-in or plugin panel is open', () => {
    expect(isAnyFooterPanelOpen(true, false, false, false, null)).toBe(true);
    expect(isAnyFooterPanelOpen(false, true, false, false, null)).toBe(true);
    expect(isAnyFooterPanelOpen(false, false, true, false, null)).toBe(true);
    expect(isAnyFooterPanelOpen(false, false, false, true, null)).toBe(true);
    expect(isAnyFooterPanelOpen(false, false, false, false, 'plugin.panel')).toBe(true);
  });
});

describe('shouldCoverBrowserGuest', () => {
  it('is false when no overlay reason is active', () => {
    expect(shouldCoverBrowserGuest({ hasBlockingModal: false, footerOpen: false })).toBe(false);
  });

  it('is true when a blocking modal is open', () => {
    expect(shouldCoverBrowserGuest({ hasBlockingModal: true, footerOpen: false })).toBe(true);
  });

  it('is true when a footer panel is open', () => {
    expect(shouldCoverBrowserGuest({ hasBlockingModal: false, footerOpen: true })).toBe(true);
  });

  it('is true when both modal and footer overlays are open', () => {
    expect(shouldCoverBrowserGuest({ hasBlockingModal: true, footerOpen: true })).toBe(true);
  });
});
