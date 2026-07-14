import { describe, expect, it, vi } from 'vitest';
import {
  focusSkipNavigationOnLaunch,
  hasBlockingModalForSkipNavigation
} from '#/renderer/src/ui/shared/skipNavigationInitialFocus';

describe('skipNavigationInitialFocus', () => {
  it('detects blocking modal dialogs', () => {
    vi.stubGlobal('document', {
      querySelector: vi.fn((selector: string) =>
        selector === '[role="dialog"][aria-modal="true"]' ? { id: 'modal' } : null
      )
    });

    expect(hasBlockingModalForSkipNavigation()).toBe(true);

    vi.unstubAllGlobals();
  });

  it('returns false when no modal dialog is open', () => {
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => null)
    });

    expect(hasBlockingModalForSkipNavigation()).toBe(false);

    vi.unstubAllGlobals();
  });

  it('focuses the launch anchor when launch focus has not been applied', () => {
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => null)
    });

    const launchAnchor = {
      focus: vi.fn()
    } as unknown as HTMLDivElement;

    expect(focusSkipNavigationOnLaunch(launchAnchor, false)).toBe('applied');
    expect(launchAnchor.focus).toHaveBeenCalledWith({ preventScroll: true });

    vi.unstubAllGlobals();
  });

  it('retries when the launch anchor is not mounted yet', () => {
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => null)
    });

    expect(focusSkipNavigationOnLaunch(null, false)).toBe('retry');

    vi.unstubAllGlobals();
  });

  it('stops when launch focus was already applied', () => {
    expect(focusSkipNavigationOnLaunch(null, true)).toBe('stop');
  });
});
