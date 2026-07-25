import { MockedFunction, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type StorageLike,
  createExternalStore,
  createStorageStore,
  setIntervalDisposable,
  syncOnWindowFocus
} from './runtime/store.js';

/**
 * Builds an in-memory storage mock for store tests.
 *
 * @param initial - Seed values keyed by storage key.
 */
function createMockStorage(initial: Record<string, unknown> = {}): StorageLike & {
  data: Record<string, unknown>;
  getMock: MockedFunction<StorageLike['get']>;
  setMock: MockedFunction<StorageLike['set']>;
} {
  const data = { ...initial };
  const getMock = vi.fn(async <T>(key: string) => data[key] as T | undefined) as MockedFunction<
    StorageLike['get']
  >;
  const setMock = vi.fn(async (key: string, value: unknown) => {
    data[key] = value;
  }) as MockedFunction<StorageLike['set']>;
  return {
    data,
    get: getMock,
    set: setMock,
    getMock,
    setMock
  };
}

describe('createExternalStore', () => {
  it('notifies subscribers when setState is called', () => {
    const store = createExternalStore(0);
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(1);
  });
});

describe('createStorageStore', () => {
  it('starts from parse(undefined)', () => {
    const storage = createMockStorage();
    const store = createStorageStore({
      storage,
      key: 'items',
      parse: (raw) => (Array.isArray(raw) ? raw : [])
    });
    expect(store.getSnapshot()).toEqual([]);
  });

  it('hydrates from storage on creation', async () => {
    const storage = createMockStorage({ count: 3 });
    const store = createStorageStore({
      storage,
      key: 'count',
      parse: (raw) => (typeof raw === 'number' ? raw : 0)
    });
    await Promise.resolve();
    expect(store.getSnapshot()).toBe(3);
  });

  it('persists and updates the snapshot via set', async () => {
    const storage = createMockStorage();
    const store = createStorageStore({
      storage,
      key: 'items',
      parse: (raw) => (Array.isArray(raw) ? raw : [])
    });
    const listener = vi.fn();
    store.subscribe(listener);

    await store.set(['a']);

    expect(store.getSnapshot()).toEqual(['a']);
    expect(storage.setMock).toHaveBeenCalledWith('items', ['a']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('leaves snapshot unchanged and rejects when storage.set fails', async () => {
    const storage = createMockStorage();
    const store = createStorageStore({
      storage,
      key: 'items',
      parse: (raw) => (Array.isArray(raw) ? raw : [])
    });
    const listener = vi.fn();
    store.subscribe(listener);
    storage.setMock.mockRejectedValueOnce(new Error('persist failed'));

    await expect(store.set(['a'])).rejects.toThrow('persist failed');

    expect(store.getSnapshot()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('skips set when equals reports no change', async () => {
    const storage = createMockStorage({ items: ['a'] });
    const store = createStorageStore({
      storage,
      key: 'items',
      parse: (raw) => (Array.isArray(raw) ? raw : [])
    });
    await store.reloadFromStorage();
    const listener = vi.fn();
    store.subscribe(listener);

    await store.set(['a']);

    expect(listener).not.toHaveBeenCalled();
    expect(storage.setMock).not.toHaveBeenCalled();
  });

  it('reloadFromStorage applies parsed storage values', async () => {
    const storage = createMockStorage({ count: 3 });
    const store = createStorageStore({
      storage,
      key: 'count',
      parse: (raw) => (typeof raw === 'number' ? raw : 0)
    });
    const listener = vi.fn();
    store.subscribe(listener);

    await store.reloadFromStorage();

    expect(store.getSnapshot()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reloadFromStorage skips notify when parsed value is unchanged', async () => {
    const storage = createMockStorage({ count: 2 });
    const store = createStorageStore({
      storage,
      key: 'count',
      parse: (raw) => (typeof raw === 'number' ? raw : 0)
    });
    await store.reloadFromStorage();
    const listener = vi.fn();
    store.subscribe(listener);

    await store.reloadFromStorage();

    expect(listener).not.toHaveBeenCalled();
  });

  it('uses a custom equals function', async () => {
    const storage = createMockStorage();
    const store = createStorageStore({
      storage,
      key: 'status',
      parse: (raw) =>
        raw && typeof raw === 'object' && 'running' in raw
          ? (raw as { running: boolean })
          : { running: false },
      equals: (a, b) => a.running === b.running
    });
    await store.set({ running: true });
    const listener = vi.fn();
    store.subscribe(listener);

    storage.data.status = { running: true, port: 8080 };
    await store.reloadFromStorage();

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({ running: true });
  });

  it('keeps the current snapshot when storage is missing and keepCurrentWhenMissing is true', async () => {
    const storage = createMockStorage();
    const store = createStorageStore({
      storage,
      key: 'status',
      parse: () => ({ running: false }),
      keepCurrentWhenMissing: true
    });
    await store.set({ running: true });
    delete storage.data.status;
    const listener = vi.fn();
    store.subscribe(listener);

    await store.reloadFromStorage();

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({ running: true });
  });
});

describe('setIntervalDisposable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes the callback on an interval until disposed', () => {
    const callback = vi.fn();
    const disposable = setIntervalDisposable(callback, 100);
    vi.advanceTimersByTime(250);
    expect(callback).toHaveBeenCalledTimes(2);
    disposable.dispose();
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe('syncOnWindowFocus', () => {
  const focusListeners = new Set<EventListener>();
  const visibilityListeners = new Set<EventListener>();
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.useFakeTimers();
    focusListeners.clear();
    visibilityListeners.clear();
    globalThis.window = {
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'focus' && typeof listener === 'function') {
          focusListeners.add(listener);
        }
      },
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'focus' && typeof listener === 'function') {
          focusListeners.delete(listener);
        }
      },
      dispatchEvent: (event: Event) => {
        if (event.type === 'focus') {
          for (const listener of focusListeners) {
            listener(event);
          }
        }
        return true;
      }
    } as unknown as Window & typeof globalThis.window;
    globalThis.document = {
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'visibilitychange' && typeof listener === 'function') {
          visibilityListeners.add(listener);
        }
      },
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'visibilitychange' && typeof listener === 'function') {
          visibilityListeners.delete(listener);
        }
      },
      dispatchEvent: (event: Event) => {
        if (event.type === 'visibilitychange') {
          for (const listener of visibilityListeners) {
            listener(event);
          }
        }
        return true;
      }
    } as unknown as Document;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('reloads stores on focus, visibility change, mount, and interval', async () => {
    const storage = createMockStorage({ count: 1 });
    const store = createStorageStore({
      storage,
      key: 'count',
      parse: (raw) => (typeof raw === 'number' ? raw : 0)
    });
    const reloadSpy = vi.spyOn(store, 'reloadFromStorage');

    const disposable = syncOnWindowFocus(store, { intervalMs: 500 });
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    storage.data.count = 2;
    window.dispatchEvent(new Event('focus'));
    expect(reloadSpy).toHaveBeenCalledTimes(2);

    storage.data.count = 3;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(reloadSpy).toHaveBeenCalledTimes(3);

    storage.data.count = 4;
    vi.advanceTimersByTime(500);
    expect(reloadSpy).toHaveBeenCalledTimes(4);

    disposable.dispose();
    storage.data.count = 5;
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(500);
    expect(reloadSpy).toHaveBeenCalledTimes(4);

    await store.reloadFromStorage();
    expect(store.getSnapshot()).toBe(5);
  });

  it('reloads multiple stores together', async () => {
    const storage = createMockStorage();
    const first = createStorageStore({
      storage,
      key: 'first',
      parse: (raw) => (typeof raw === 'number' ? raw : 0)
    });
    const second = createStorageStore({
      storage,
      key: 'second',
      parse: (raw) => (typeof raw === 'number' ? raw : 0)
    });
    const reloadFirst = vi.spyOn(first, 'reloadFromStorage');
    const reloadSecond = vi.spyOn(second, 'reloadFromStorage');

    syncOnWindowFocus([first, second]).dispose();

    expect(reloadFirst).toHaveBeenCalledTimes(1);
    expect(reloadSecond).toHaveBeenCalledTimes(1);
  });
});
