import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import {
  clearMainWindowReveal,
  isMainWindowRevealed,
  registerMainWindowReveal,
  requestMainWindowReveal,
  resetMainWindowRevealForTests,
  startUiReadyTimeout,
  UI_READY_TIMEOUT_MS
} from './mainWindowReveal';

/**
 * Builds a minimal BrowserWindow stub for reveal registry tests.
 *
 * @returns Fake window with an undestroyed webContents identity.
 */
function createWindowStub(): BrowserWindow {
  return {
    isDestroyed: () => false,
    webContents: { id: 1 }
  } as unknown as BrowserWindow;
}

describe('mainWindowReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMainWindowRevealForTests();
  });

  afterEach(() => {
    clearMainWindowReveal();
    vi.useRealTimers();
  });

  it('invokes the reveal callback once for the first request', () => {
    const onReveal = vi.fn();
    registerMainWindowReveal(createWindowStub(), onReveal);

    expect(requestMainWindowReveal('renderer')).toBe(true);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledWith('renderer');
  });

  it('ignores subsequent reveal requests after the first', () => {
    const onReveal = vi.fn();
    registerMainWindowReveal(createWindowStub(), onReveal);

    expect(requestMainWindowReveal('renderer')).toBe(true);
    expect(requestMainWindowReveal('timeout')).toBe(false);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('forces reveal when the UI-ready timeout elapses', () => {
    const onReveal = vi.fn();
    const onTimeout = vi.fn();
    registerMainWindowReveal(createWindowStub(), onReveal);
    startUiReadyTimeout(onTimeout);

    vi.advanceTimersByTime(UI_READY_TIMEOUT_MS - 1);
    expect(onReveal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onReveal).toHaveBeenCalledWith('ui-ready-timeout');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('cancels the timeout when the renderer reveals first', () => {
    const onReveal = vi.fn();
    const onTimeout = vi.fn();
    registerMainWindowReveal(createWindowStub(), onReveal);
    startUiReadyTimeout(onTimeout);

    requestMainWindowReveal('renderer');
    vi.advanceTimersByTime(UI_READY_TIMEOUT_MS);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledWith('renderer');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('reports revealed state after the first successful reveal', () => {
    registerMainWindowReveal(createWindowStub(), vi.fn());
    expect(isMainWindowRevealed()).toBe(false);
    requestMainWindowReveal('renderer');
    expect(isMainWindowRevealed()).toBe(true);
  });
});
