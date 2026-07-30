import { describe, expect, it, vi } from 'vitest';
import type { RootState } from '#/renderer/src/store/redux';
import { runBrowserNavMenuAction } from './runBrowserNavMenuAction';

describe('runBrowserNavMenuAction', () => {
  it('calls browser reload IPC for an active Live Page tab', () => {
    const browserReload = vi.fn();
    vi.stubGlobal('window', {
      api: {
        browserReload,
        browserGoBack: vi.fn(),
        browserGoForward: vi.fn(),
        focusRenderer: vi.fn()
      }
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

    runBrowserNavMenuAction('browser-reload', getState);

    expect(browserReload).toHaveBeenCalledWith('browser-1');
    vi.unstubAllGlobals();
  });

  it('no-ops reload when the active tab is not a Live Page', () => {
    const browserReload = vi.fn();
    vi.stubGlobal('window', {
      api: {
        browserReload,
        browserGoBack: vi.fn(),
        browserGoForward: vi.fn(),
        focusRenderer: vi.fn()
      }
    });

    const getState = (): RootState =>
      ({
        tabs: {
          tabs: [{ kind: 'request', tabId: 'req-1' }],
          activeTabId: 'req-1'
        }
      }) as unknown as RootState;

    runBrowserNavMenuAction('browser-reload', getState);

    expect(browserReload).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
