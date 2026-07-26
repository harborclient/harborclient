import { describe, expect, it, vi } from 'vitest';
import { coalesceInFlightRefresh, shouldSetLoadingForPluginListRefresh } from './pluginListRefresh';

describe('shouldSetLoadingForPluginListRefresh', () => {
  it('shows loading only before the first successful list load', () => {
    expect(shouldSetLoadingForPluginListRefresh(false)).toBe(true);
    expect(shouldSetLoadingForPluginListRefresh(true)).toBe(false);
  });
});

describe('coalesceInFlightRefresh', () => {
  it('reuses one in-flight promise for concurrent callers', async () => {
    const inFlightRef: { current: Promise<string[]> | null } = { current: null };
    const start = vi.fn(async () => {
      await Promise.resolve();
      return ['a'];
    });

    const first = coalesceInFlightRefresh(inFlightRef, start);
    const second = coalesceInFlightRefresh(inFlightRef, start);

    expect(first).toBe(second);
    expect(start).toHaveBeenCalledTimes(1);
    await expect(first).resolves.toEqual(['a']);
    expect(inFlightRef.current).toBeNull();
  });

  it('starts a new refresh after the previous one settles', async () => {
    const inFlightRef: { current: Promise<number> | null } = { current: null };
    let calls = 0;
    const start = vi.fn(async () => {
      calls += 1;
      return calls;
    });

    await expect(coalesceInFlightRefresh(inFlightRef, start)).resolves.toBe(1);
    await expect(coalesceInFlightRefresh(inFlightRef, start)).resolves.toBe(2);
    expect(start).toHaveBeenCalledTimes(2);
  });
});
