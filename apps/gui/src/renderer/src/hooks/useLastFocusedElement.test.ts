import { describe, expect, it, vi } from 'vitest';
import { restoreLastFocusWithoutRing } from './useLastFocusedElement';

describe('restoreLastFocusWithoutRing', () => {
  it('focuses the stored element without showing a focus ring', () => {
    const focus = vi.fn();
    const element = { isConnected: true, focus } as unknown as HTMLElement;

    restoreLastFocusWithoutRing({ current: element });

    expect(focus).toHaveBeenCalledWith({ focusVisible: false });
  });

  it('no-ops when the ref is empty', () => {
    const focus = vi.fn();

    restoreLastFocusWithoutRing({ current: null });

    expect(focus).not.toHaveBeenCalled();
  });

  it('no-ops when the stored element is disconnected', () => {
    const focus = vi.fn();
    const element = { isConnected: false, focus } as unknown as HTMLElement;

    restoreLastFocusWithoutRing({ current: element });

    expect(focus).not.toHaveBeenCalled();
  });
});
