import { describe, expect, it, vi } from 'vitest';
import {
  focusSkipNavigation,
  focusSkipNavigationOnLaunch,
  focusSkipTarget,
  hasBlockingModalForSkipNavigation
} from '#/renderer/src/ui/shared/skipNavigationInitialFocus';
import { SKIP_NAVIGATION_ID } from '#/renderer/src/ui/shared/skipNavigationTargets';

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

  it('focuses a skip target without scrolling', () => {
    const target = {
      focus: vi.fn()
    } as unknown as HTMLElement;

    vi.stubGlobal('document', {
      getElementById: vi.fn((id: string) => (id === 'response-editor' ? target : null)),
      activeElement: target
    });

    expect(focusSkipTarget('response-editor')).toBe(true);
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });

    vi.unstubAllGlobals();
  });

  it('returns false when the skip target is missing', () => {
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => null)
    });

    expect(focusSkipTarget('missing-target')).toBe(false);

    vi.unstubAllGlobals();
  });

  it('focuses the first skip link inside the skip navigation menu', () => {
    const mainNavLink = {
      focus: vi.fn()
    } as unknown as HTMLAnchorElement;

    const nav = {
      focus: vi.fn(),
      querySelector: vi.fn(() => mainNavLink)
    } as unknown as HTMLElement;

    vi.stubGlobal('document', {
      getElementById: vi.fn((id: string) => (id === SKIP_NAVIGATION_ID ? nav : null)),
      activeElement: mainNavLink
    });

    expect(focusSkipNavigation()).toBe(true);
    expect(mainNavLink.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(nav.focus).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('falls back to the skip navigation container when no link is present', () => {
    const nav = {
      focus: vi.fn(),
      querySelector: vi.fn(() => null)
    } as unknown as HTMLElement;

    vi.stubGlobal('document', {
      getElementById: vi.fn((id: string) => (id === SKIP_NAVIGATION_ID ? nav : null)),
      activeElement: nav
    });

    expect(focusSkipNavigation()).toBe(true);
    expect(nav.focus).toHaveBeenCalledWith({ preventScroll: true });

    vi.unstubAllGlobals();
  });
});
