import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coverBrowserGuestForOverlay,
  dismissBrowserGuestCover,
  getBrowserGuestCover,
  resetBrowserGuestCoverForTests,
  subscribeBrowserGuestCover,
  uncoverBrowserGuest
} from './browserGuestCover';

describe('browserGuestCover', () => {
  beforeEach(() => {
    resetBrowserGuestCoverForTests();
    vi.stubGlobal('window', {
      api: {
        browserCapturePage: vi.fn(async () => ({
          dataUrl: 'data:image/png;base64,abc',
          truncated: false
        })),
        browserSetVisible: vi.fn(async () => undefined)
      }
    });
  });

  afterEach(() => {
    resetBrowserGuestCoverForTests();
    vi.unstubAllGlobals();
  });

  it('captures, publishes a freeze frame, and hides the guest', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBrowserGuestCover(listener);

    await coverBrowserGuestForOverlay('tab-1');

    expect(window.api.browserCapturePage).toHaveBeenCalledWith('tab-1', { fullPage: false });
    expect(window.api.browserSetVisible).toHaveBeenCalledWith('tab-1', false);
    expect(getBrowserGuestCover()).toEqual({
      tabId: 'tab-1',
      dataUrl: 'data:image/png;base64,abc'
    });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('re-hides the guest when the same tab is already covered', async () => {
    await coverBrowserGuestForOverlay('tab-1');
    vi.mocked(window.api.browserCapturePage).mockClear();
    vi.mocked(window.api.browserSetVisible).mockClear();

    await coverBrowserGuestForOverlay('tab-1');

    expect(window.api.browserCapturePage).not.toHaveBeenCalled();
    expect(window.api.browserSetVisible).toHaveBeenCalledWith('tab-1', false);
  });

  it('restores the guest when uncovered', async () => {
    await coverBrowserGuestForOverlay('tab-1');
    await uncoverBrowserGuest();

    expect(getBrowserGuestCover()).toBeNull();
    expect(window.api.browserSetVisible).toHaveBeenLastCalledWith('tab-1', true);
  });

  it('dismisses cover without restoring visibility', async () => {
    await coverBrowserGuestForOverlay('tab-1');
    vi.mocked(window.api.browserSetVisible).mockClear();

    dismissBrowserGuestCover('tab-1');

    expect(getBrowserGuestCover()).toBeNull();
    expect(window.api.browserSetVisible).not.toHaveBeenCalled();
  });

  it('still hides the guest when capture fails', async () => {
    vi.mocked(window.api.browserCapturePage).mockRejectedValueOnce(new Error('busy'));

    await coverBrowserGuestForOverlay('tab-1');

    expect(getBrowserGuestCover()).toEqual({ tabId: 'tab-1', dataUrl: '' });
    expect(window.api.browserSetVisible).toHaveBeenCalledWith('tab-1', false);
  });
});
