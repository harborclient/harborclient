import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESIZABLE_SYNC_EVENT, applyResizableSizes } from './applyResizableSizes.js';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  });
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn()
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyResizableSizes', () => {
  it('writes finite sizes and dispatches the sync event', () => {
    applyResizableSizes({
      'hc.sidebarWidth': 420.6,
      'hc.consoleHeight': Number.NaN,
      'hc.aiSidebarWidth': 300
    });

    expect(localStorage.getItem('hc.sidebarWidth')).toBe('421');
    expect(localStorage.getItem('hc.aiSidebarWidth')).toBe('300');
    expect(localStorage.getItem('hc.consoleHeight')).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: RESIZABLE_SYNC_EVENT })
    );
  });
});
