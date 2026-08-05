import { afterEach, describe, expect, it } from 'vitest';
import { getPendingLiveServerLockIds, withLiveServerLock } from './liveServerLock';

afterEach(async () => {
  // Drain any leftover lock work so tests do not leak pending ids.
  const pending = getPendingLiveServerLockIds();
  await Promise.all(pending.map((id) => withLiveServerLock(id, async () => undefined)));
});

describe('withLiveServerLock', () => {
  it('runs same-id tasks sequentially', async () => {
    const order: string[] = [];

    const first = withLiveServerLock('a', async () => {
      order.push('first-start');
      await new Promise((resolve) => setTimeout(resolve, 30));
      order.push('first-end');
      return 1;
    });
    const second = withLiveServerLock('a', async () => {
      order.push('second-start');
      order.push('second-end');
      return 2;
    });

    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });

  it('allows different ids to overlap', async () => {
    let aEntered = false;
    let bEnteredWhileAHeld = false;
    let releaseA!: () => void;
    const aGate = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const a = withLiveServerLock('a', async () => {
      aEntered = true;
      await aGate;
    });
    // Wait until A holds the lock before starting B.
    const deadline = Date.now() + 1000;
    while (!aEntered && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(aEntered).toBe(true);

    const b = withLiveServerLock('b', async () => {
      bEnteredWhileAHeld = true;
    });
    await b;
    expect(bEnteredWhileAHeld).toBe(true);
    releaseA();
    await a;
  });

  it('does not wedge the queue when a task rejects', async () => {
    await expect(
      withLiveServerLock('fail', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    await expect(withLiveServerLock('fail', async () => 'recovered')).resolves.toBe('recovered');
  });

  it('clears pending ids after all work settles', async () => {
    await withLiveServerLock('cleanup', async () => 'done');
    expect(getPendingLiveServerLockIds()).toEqual([]);
  });

  it('reports pending ids while work is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const pending = withLiveServerLock('inflight', async () => {
      await gate;
    });

    expect(getPendingLiveServerLockIds()).toContain('inflight');
    release();
    await pending;
    expect(getPendingLiveServerLockIds()).not.toContain('inflight');
  });
});
