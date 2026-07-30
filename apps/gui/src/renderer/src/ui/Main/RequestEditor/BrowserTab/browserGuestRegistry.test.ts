import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearBrowserGuest,
  hasBrowserGuest,
  markBrowserGuestCreated,
  resetBrowserGuestRegistryForTests,
  syncDestroyedBrowserGuests
} from './browserGuestRegistry';

describe('browserGuestRegistry', () => {
  beforeEach(() => {
    resetBrowserGuestRegistryForTests();
    vi.stubGlobal('window', {
      api: {
        browserDestroy: vi.fn(async () => undefined)
      }
    });
  });

  afterEach(() => {
    resetBrowserGuestRegistryForTests();
    vi.unstubAllGlobals();
  });

  it('tracks created guests', () => {
    expect(hasBrowserGuest('a')).toBe(false);
    markBrowserGuestCreated('a');
    expect(hasBrowserGuest('a')).toBe(true);
    clearBrowserGuest('a');
    expect(hasBrowserGuest('a')).toBe(false);
  });

  it('force-destroys guests for tabs no longer open', () => {
    markBrowserGuestCreated('open');
    markBrowserGuestCreated('closed');
    syncDestroyedBrowserGuests(new Set(['open']));
    expect(hasBrowserGuest('open')).toBe(true);
    expect(hasBrowserGuest('closed')).toBe(false);
    expect(window.api.browserDestroy).toHaveBeenCalledWith('closed');
    expect(window.api.browserDestroy).not.toHaveBeenCalledWith('open');
  });

  it('skips IPC when clearBrowserGuest already ran after requestClose', () => {
    markBrowserGuestCreated('gone');
    clearBrowserGuest('gone');
    syncDestroyedBrowserGuests(new Set());
    expect(window.api.browserDestroy).not.toHaveBeenCalled();
  });
});
