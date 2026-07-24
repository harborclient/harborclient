import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

describe('resolveCliScriptPath', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns the packaged resources path when packaged and present', async () => {
    vi.doMock('electron', () => ({
      app: { isPackaged: true }
    }));
    vi.doMock('node:fs', () => ({
      existsSync: (path: string) => String(path).endsWith('cli/index.js')
    }));

    Object.defineProperty(process, 'resourcesPath', {
      value: '/tmp/HarborClient/resources',
      configurable: true
    });
    const { resolveCliScriptPath } = await import('./runCliProcess');
    expect(resolveCliScriptPath()).toBe('/tmp/HarborClient/resources/cli/index.js');
  });

  it('returns null when packaged and the CLI resource is missing', async () => {
    vi.doMock('electron', () => ({
      app: { isPackaged: true }
    }));
    vi.doMock('node:fs', () => ({
      existsSync: () => false
    }));

    Object.defineProperty(process, 'resourcesPath', {
      value: '/tmp/HarborClient/resources',
      configurable: true
    });
    const { resolveCliScriptPath } = await import('./runCliProcess');
    expect(resolveCliScriptPath()).toBeNull();
  });
});

describe('runCliProcess', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 1 when the CLI script is missing', async () => {
    vi.doMock('electron', () => ({
      app: { isPackaged: false }
    }));
    vi.doMock('node:fs', () => ({
      existsSync: () => false
    }));

    const { runCliProcess } = await import('./runCliProcess');
    await expect(runCliProcess(['GET', 'https://example.com'])).resolves.toBe(1);
  });

  it('spawns Electron as Node and forwards the exit code', async () => {
    vi.doMock('electron', () => ({
      app: { isPackaged: false }
    }));
    vi.doMock('node:fs', () => ({
      existsSync: () => true
    }));

    const { spawn } = await import('node:child_process');
    vi.mocked(spawn).mockImplementation(() => {
      return {
        on(event: string, cb: (...args: unknown[]) => void) {
          if (event === 'exit') {
            queueMicrotask(() => cb(0, null));
          }
          return this;
        }
      } as unknown as ReturnType<typeof spawn>;
    });

    const { runCliProcess } = await import('./runCliProcess');
    await expect(runCliProcess(['GET', 'https://example.com'])).resolves.toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['GET', 'https://example.com']),
      expect.objectContaining({
        env: expect.objectContaining({ ELECTRON_RUN_AS_NODE: '1' }),
        stdio: 'inherit'
      })
    );
  });
});
