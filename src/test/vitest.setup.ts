import { tmpdir } from 'os';
import { vi } from 'vitest';

/**
 * Shared in-memory backing store for the global `electron-store` mock.
 *
 * `electron-store` requires the Electron binary at import time, which is often
 * missing in CI. Individual test files may override this mock with `vi.mock`.
 */
const electronStoreData = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('electron-store', () => ({
  default: class MockElectronStore {
    /**
     * Seeds default keys on first construction, mirroring real store behavior.
     *
     * @param opts - Store options (`defaults` only is used in tests).
     */
    constructor(opts?: { defaults?: Record<string, unknown> }) {
      const defaults = opts?.defaults ?? {};
      for (const [key, value] of Object.entries(defaults)) {
        if (!(key in electronStoreData)) {
          electronStoreData[key] = structuredClone(value);
        }
      }
    }

    /**
     * Reads a persisted value or returns the provided default.
     *
     * @param key - Settings key.
     * @param defaultValue - Fallback when unset.
     */
    get(key: string, defaultValue?: unknown): unknown {
      return key in electronStoreData ? electronStoreData[key] : defaultValue;
    }

    /**
     * Persists a value under the given key.
     *
     * @param key - Settings key.
     * @param value - Value to store.
     */
    set(key: string, value: unknown): void {
      electronStoreData[key] = value;
    }
  }
}));

/**
 * Stubs Electron for the Node-based vitest runner.
 *
 * Main-process modules import `electron` at load time. The npm package throws
 * when its binary was not downloaded (common in CI with a warm pnpm cache), and
 * even when installed it only exports the executable path—not `app` or
 * `safeStorage`. Tests that exercise those modules under vitest need this stub.
 */
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData' || name === 'appData') {
        return tmpdir();
      }
      return tmpdir();
    })
  },
  session: {
    defaultSession: {
      setSpellCheckerEnabled: vi.fn()
    }
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf8')),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString('utf8'))
  },
  BrowserWindow: class {},
  screen: { getAllDisplays: () => [] }
}));
