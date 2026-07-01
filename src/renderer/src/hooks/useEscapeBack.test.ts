import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  handleEscapeBackKeydown,
  isDomModalOpen,
  shouldHandleEscapeBack
} from '#/renderer/src/hooks/useEscapeBack';

describe('shouldHandleEscapeBack', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when disabled', () => {
    expect(shouldHandleEscapeBack(false, false)).toBe(false);
  });

  it('returns false when a redux modal is blocking', () => {
    expect(shouldHandleEscapeBack(true, true)).toBe(false);
  });

  it('returns false when a dom modal is open', () => {
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => ({}))
    });

    expect(shouldHandleEscapeBack(true, false)).toBe(false);
  });

  it('returns true when enabled and nothing is blocking', () => {
    expect(shouldHandleEscapeBack(true, false)).toBe(true);
  });
});

describe('handleEscapeBackKeydown', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('invokes onBack for Escape when navigation is allowed', () => {
    const onBack = vi.fn();

    handleEscapeBackKeydown({ key: 'Escape' } as KeyboardEvent, true, false, onBack);

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('ignores non-Escape keys', () => {
    const onBack = vi.fn();

    handleEscapeBackKeydown({ key: 'Enter' } as KeyboardEvent, true, false, onBack);

    expect(onBack).not.toHaveBeenCalled();
  });

  it('does not invoke onBack when disabled', () => {
    const onBack = vi.fn();

    handleEscapeBackKeydown({ key: 'Escape' } as KeyboardEvent, false, false, onBack);

    expect(onBack).not.toHaveBeenCalled();
  });

  it('does not invoke onBack when a redux modal is blocking', () => {
    const onBack = vi.fn();

    handleEscapeBackKeydown({ key: 'Escape' } as KeyboardEvent, true, true, onBack);

    expect(onBack).not.toHaveBeenCalled();
  });
});

describe('isDomModalOpen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when document is unavailable', () => {
    expect(isDomModalOpen()).toBe(false);
  });

  it('returns false when no modal is mounted', () => {
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => null)
    });

    expect(isDomModalOpen()).toBe(false);
  });

  it('returns true when an aria-modal element exists', () => {
    vi.stubGlobal('document', {
      querySelector: vi.fn((selector: string) => (selector === '[aria-modal="true"]' ? {} : null))
    });

    expect(isDomModalOpen()).toBe(true);
  });
});
