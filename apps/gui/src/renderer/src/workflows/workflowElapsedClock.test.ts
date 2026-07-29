import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  prefersReducedMotion,
  startWorkflowElapsedClock,
  WORKFLOW_ELAPSED_REDUCED_MOTION_INTERVAL_MS
} from './workflowElapsedClock';

describe('workflowElapsedClock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('detects prefers-reduced-motion', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('window', { matchMedia: undefined });
    expect(prefersReducedMotion()).toBe(false);
  });

  it('drives ticks with requestAnimationFrame when motion is allowed', () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal('window', {
      requestAnimationFrame,
      cancelAnimationFrame,
      setInterval: vi.fn(),
      clearInterval: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false }))
    });

    const onTick = vi.fn();
    const stop = startWorkflowElapsedClock(onTick, {
      prefersReducedMotion: () => false
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(onTick).not.toHaveBeenCalled();

    callbacks[0]!(0);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

    callbacks[1]!(16);
    expect(onTick).toHaveBeenCalledTimes(2);

    stop();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(3);
    const ticksAfterStop = onTick.mock.calls.length;
    callbacks[2]?.(32);
    expect(onTick).toHaveBeenCalledTimes(ticksAfterStop);
  });

  it('falls back to an interval when reduced motion is preferred', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.fn((handler: TimerHandler, timeout?: number) => {
      return globalThis.setInterval(handler, timeout);
    });
    const clearIntervalSpy = vi.fn((id: ReturnType<typeof setInterval>) => {
      globalThis.clearInterval(id);
    });
    vi.stubGlobal('window', {
      setInterval: setIntervalSpy,
      clearInterval: clearIntervalSpy,
      requestAnimationFrame: vi.fn(),
      cancelAnimationFrame: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: true }))
    });

    const onTick = vi.fn();
    const stop = startWorkflowElapsedClock(onTick, {
      prefersReducedMotion: () => true
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      WORKFLOW_ELAPSED_REDUCED_MOTION_INTERVAL_MS
    );
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();

    vi.advanceTimersByTime(WORKFLOW_ELAPSED_REDUCED_MOTION_INTERVAL_MS);
    expect(onTick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(WORKFLOW_ELAPSED_REDUCED_MOTION_INTERVAL_MS);
    expect(onTick).toHaveBeenCalledTimes(2);

    stop();
    expect(clearIntervalSpy).toHaveBeenCalled();
    vi.advanceTimersByTime(WORKFLOW_ELAPSED_REDUCED_MOTION_INTERVAL_MS * 2);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('skips onTick while shouldTick returns false', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('window', {
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
      cancelAnimationFrame: vi.fn(),
      setInterval: vi.fn(),
      clearInterval: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false }))
    });

    let active = false;
    const onTick = vi.fn();
    const stop = startWorkflowElapsedClock(onTick, {
      shouldTick: () => active,
      prefersReducedMotion: () => false
    });

    callbacks[0]!(0);
    expect(onTick).not.toHaveBeenCalled();

    active = true;
    callbacks[1]!(16);
    expect(onTick).toHaveBeenCalledTimes(1);

    stop();
  });
});
