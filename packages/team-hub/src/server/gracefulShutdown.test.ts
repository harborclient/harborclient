import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  registerGracefulShutdown,
  resolveShutdownTimeoutMs
} from '#/server/gracefulShutdown.js';
import type { RuntimeContext } from '#/server/runtimeContext.js';
import { resetShuttingDownForTests } from '#/server/shutdownState.js';

describe('resolveShutdownTimeoutMs', () => {
  it('returns the explicit timeout when positive', () => {
    expect(resolveShutdownTimeoutMs(12_000)).toBe(12_000);
  });

  it('falls back to the default when unset', () => {
    const previous = process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS;
    delete process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS;
    expect(resolveShutdownTimeoutMs()).toBe(DEFAULT_SHUTDOWN_TIMEOUT_MS);
    if (previous === undefined) {
      delete process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS;
    } else {
      process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS = previous;
    }
  });

  it('reads TEAM_HUB_SHUTDOWN_TIMEOUT_MS from the environment', () => {
    const previous = process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS;
    process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS = '15000';
    expect(resolveShutdownTimeoutMs()).toBe(15_000);
    if (previous === undefined) {
      delete process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS;
    } else {
      process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS = previous;
    }
  });
});

describe('registerGracefulShutdown', () => {
  /**
   * Builds injectable doubles for one shutdown coordinator test.
   */
  function createShutdownHarness() {
    resetShuttingDownForTests();

    const closeApp = vi.fn().mockResolvedValue(undefined);
    const disposeMcp = vi.fn().mockResolvedValue(undefined);
    const disconnectRuntime = vi.fn().mockResolvedValue(undefined);
    const exitProcess = vi.fn();
    const handlers = new Map<NodeJS.Signals, () => void>();
    const timers: Array<{ callback: () => void; ms: number }> = [];

    const app = {
      close: closeApp,
      log: {
        info: vi.fn(),
        error: vi.fn()
      }
    } as unknown as FastifyInstance;

    const ctx = {} as RuntimeContext;

    registerGracefulShutdown(app, ctx, {
      timeoutMs: 5_000,
      closeApp,
      disposeMcp,
      disconnectRuntime,
      exitProcess,
      onSignal: (signal, handler) => {
        handlers.set(signal, handler);
      },
      setForceExitTimer: (callback, ms) => {
        timers.push({ callback, ms });
        return { id: timers.length } as unknown as NodeJS.Timeout;
      },
      clearForceExitTimer: vi.fn()
    });

    return {
      app,
      closeApp,
      disposeMcp,
      disconnectRuntime,
      exitProcess,
      handlers,
      timers
    };
  }

  it('runs close, MCP dispose, and disconnect in order then exits 0', async () => {
    const harness = createShutdownHarness();
    const order: string[] = [];
    harness.closeApp.mockImplementation(async () => {
      order.push('close');
    });
    harness.disposeMcp.mockImplementation(async () => {
      order.push('mcp');
    });
    harness.disconnectRuntime.mockImplementation(async () => {
      order.push('disconnect');
    });

    harness.handlers.get('SIGTERM')?.();
    await vi.waitFor(() => {
      expect(harness.exitProcess).toHaveBeenCalledWith(0);
    });

    expect(order).toEqual(['close', 'mcp', 'disconnect']);
    expect(harness.disposeMcp).toHaveBeenCalledWith({ timeoutMs: 1_000 });
    expect(harness.app.log.info).toHaveBeenCalledWith('Received SIGTERM, shutting down.');
  });

  it('ignores a second signal while shutdown is in progress', async () => {
    const harness = createShutdownHarness();
    let resolveClose: (() => void) | undefined;
    harness.closeApp.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        })
    );

    harness.handlers.get('SIGTERM')?.();
    harness.handlers.get('SIGINT')?.();

    expect(harness.closeApp).toHaveBeenCalledOnce();

    resolveClose?.();
    await vi.waitFor(() => {
      expect(harness.exitProcess).toHaveBeenCalledWith(0);
    });
  });

  it('force-exits with code 1 when the timeout fires', async () => {
    const harness = createShutdownHarness();
    harness.closeApp.mockImplementation(() => new Promise(() => undefined));

    harness.handlers.get('SIGTERM')?.();
    expect(harness.timers).toHaveLength(1);
    expect(harness.timers[0]?.ms).toBe(5_000);

    harness.timers[0]?.callback();

    expect(harness.exitProcess).toHaveBeenCalledWith(1);
    expect(harness.app.log.error).toHaveBeenCalledWith(
      'Graceful shutdown timed out after 5000ms; forcing exit.'
    );
  });
});
