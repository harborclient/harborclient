import { describe, expect, it, vi } from 'vitest';
import type { RootState } from '#/renderer/src/store/redux';
import { browserAddressInputId, focusBrowserAddress } from './focusBrowserAddress';

describe('browserAddressInputId', () => {
  it('builds the stable address input id for a tab', () => {
    expect(browserAddressInputId('tab-1')).toBe('browser-address-tab-1');
  });
});

describe('focusBrowserAddress', () => {
  it('focuses the shell then selects the active Live Page address input', async () => {
    const focus = vi.fn();
    const select = vi.fn();
    const focusRenderer = vi.fn().mockResolvedValue(undefined);
    const getElementById = vi.fn().mockReturnValue({ focus, select });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', { getElementById });
    vi.stubGlobal('window', {
      api: { focusRenderer }
    });

    const getState = (): RootState =>
      ({
        tabs: {
          tabs: [
            {
              kind: 'browser',
              tabId: 'browser-1',
              url: 'https://example.com',
              title: 'Example'
            }
          ],
          activeTabId: 'browser-1'
        }
      }) as unknown as RootState;

    focusBrowserAddress(getState);

    expect(focusRenderer).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(getElementById).toHaveBeenCalledWith('browser-address-browser-1');
    expect(focus).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('no-ops when the active tab is not a Live Page', () => {
    const focusRenderer = vi.fn();
    vi.stubGlobal('window', {
      api: { focusRenderer }
    });

    const getState = (): RootState =>
      ({
        tabs: {
          tabs: [{ kind: 'request', tabId: 'req-1' }],
          activeTabId: 'req-1'
        }
      }) as unknown as RootState;

    focusBrowserAddress(getState);

    expect(focusRenderer).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
