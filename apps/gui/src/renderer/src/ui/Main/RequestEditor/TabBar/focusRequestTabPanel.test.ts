import { describe, expect, it, vi } from 'vitest';
import {
  focusFirstFocusableInRequestTabPanel,
  requestTabPanelElementId,
  resolveRequestTabIdFromFocusTarget
} from './focusRequestTabPanel';

describe('resolveRequestTabIdFromFocusTarget', () => {
  it('returns the tab id when focus is on a tab label', () => {
    const tab = {
      id: 'request-tab-tab-abc',
      closest: (selector: string) => (selector === '[role="tab"]' ? tab : null)
    };

    expect(resolveRequestTabIdFromFocusTarget(tab as never)).toBe('tab-abc');
  });

  it('returns the tab id when focus is on a control inside the tab row', () => {
    const tab = { id: 'request-tab-tab-abc' };
    const closeButton = {
      closest: (selector: string) => (selector === '[role="tab"]' ? tab : null)
    };

    expect(resolveRequestTabIdFromFocusTarget(closeButton as never)).toBe('tab-abc');
  });

  it('returns null for unrelated elements', () => {
    expect(
      resolveRequestTabIdFromFocusTarget({
        closest: () => null
      } as never)
    ).toBeNull();
  });
});

describe('focusFirstFocusableInRequestTabPanel', () => {
  it('focuses the first focusable element in the linked panel', () => {
    const focus = vi.fn();
    const input = { focus, offsetParent: {}, closest: () => null };
    const panel = {
      querySelectorAll: vi.fn(() => [input])
    };

    vi.stubGlobal('document', {
      getElementById: vi.fn((id: string) =>
        id === requestTabPanelElementId('tab-1') ? panel : null
      )
    });
    vi.stubGlobal(
      'getComputedStyle',
      vi.fn(() => ({ position: 'static' }))
    );

    expect(focusFirstFocusableInRequestTabPanel('tab-1')).toBe(true);
    expect(focus).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('returns false when the panel is missing', () => {
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => null)
    });

    expect(focusFirstFocusableInRequestTabPanel('missing')).toBe(false);

    vi.unstubAllGlobals();
  });
});
