import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearTabSaveRegistry,
  registerTabSave,
  tryInvokeTabSave,
  unregisterTabSave
} from './tabSaveRegistry';

describe('tabSaveRegistry', () => {
  /**
   * Clears registrations so tests do not leak handlers across cases.
   */
  afterEach(() => {
    clearTabSaveRegistry();
  });

  it('invokes save when a handler is registered and canSave is true', () => {
    const save = vi.fn();
    registerTabSave('tab-1', { canSave: true, save });

    expect(tryInvokeTabSave('tab-1')).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not invoke save when canSave is false', () => {
    const save = vi.fn();
    registerTabSave('tab-1', { canSave: false, save });

    expect(tryInvokeTabSave('tab-1')).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('returns false when no handler is registered', () => {
    expect(tryInvokeTabSave('missing')).toBe(false);
  });

  it('stops invoking after unregister', () => {
    const save = vi.fn();
    registerTabSave('tab-1', { canSave: true, save });
    unregisterTabSave('tab-1');

    expect(tryInvokeTabSave('tab-1')).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('uses the latest registered save callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    registerTabSave('tab-1', { canSave: true, save: first });
    registerTabSave('tab-1', { canSave: true, save: second });

    expect(tryInvokeTabSave('tab-1')).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
