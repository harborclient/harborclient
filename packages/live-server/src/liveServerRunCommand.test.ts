import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import {
  isLiveServerRunCommandCrash,
  liveServerRunCommandBackoffMs,
  parseRunCommandArgv,
  startLiveServerRunCommand
} from './liveServerRunCommand';

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

import { spawn } from 'node:child_process';

const spawnMock = vi.mocked(spawn);

/**
 * Minimal readable stream stand-in for child stdout/stderr.
 */
class MockPipe extends EventEmitter {
  /**
   * Accepts encoding like Node Readable.setEncoding (no-op for the mock).
   */
  setEncoding(): void {
    // Encoding is applied by callers; the mock emits strings directly.
  }
}

/**
 * Minimal mock child process that emits close/error like Node's ChildProcess.
 */
class MockChild extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killed = false;
  stdout = new MockPipe();
  stderr = new MockPipe();

  /**
   * Records the kill signal and emits close.
   *
   * @param signal - Signal name or numeric code.
   * @returns True (Node ChildProcess.kill returns boolean).
   */
  kill(signal?: NodeJS.Signals | number): boolean {
    this.killed = true;
    const name = typeof signal === 'string' ? signal : signal === 9 ? 'SIGKILL' : 'SIGTERM';
    this.signalCode = name as NodeJS.Signals;
    queueMicrotask(() => {
      this.emit('close', null, name);
    });
    return true;
  }

  /**
   * Emits a clean or failed close with an exit code.
   *
   * @param code - Exit code.
   */
  closeWithCode(code: number): void {
    this.exitCode = code;
    this.emit('close', code, null);
  }
}

/**
 * Creates a mock ChildProcess and wires it as the next spawn result.
 *
 * Emits `spawn` on the next microtask so awaiters of the initial start resolve.
 *
 * @returns The mock child instance.
 */
function nextMockChild(): MockChild {
  const child = new MockChild();
  spawnMock.mockImplementation(() => {
    queueMicrotask(() => {
      child.emit('spawn');
    });
    return child as unknown as ChildProcess;
  });
  return child;
}

afterEach(() => {
  spawnMock.mockReset();
  vi.useRealTimers();
});

describe('parseRunCommandArgv', () => {
  it('splits on whitespace and preserves quoted segments', () => {
    expect(parseRunCommandArgv('/usr/bin/node /home/sean/server.js')).toEqual([
      '/usr/bin/node',
      '/home/sean/server.js'
    ]);
    expect(parseRunCommandArgv(`'/usr/bin/node' "./my server.js"`)).toEqual([
      '/usr/bin/node',
      './my server.js'
    ]);
    expect(parseRunCommandArgv('/bin/echo hello\\ world')).toEqual(['/bin/echo', 'hello world']);
  });

  it('rejects empty or unbalanced input', () => {
    expect(() => parseRunCommandArgv('')).toThrow(/empty/i);
    expect(() => parseRunCommandArgv('   ')).toThrow(/empty/i);
    expect(() => parseRunCommandArgv('"unterminated')).toThrow(/quotes/i);
    expect(() => parseRunCommandArgv('foo\\')).toThrow(/escape/i);
  });
});

describe('isLiveServerRunCommandCrash', () => {
  it('treats exit 0 as clean and non-zero/signal as crash', () => {
    expect(isLiveServerRunCommandCrash(0, null)).toBe(false);
    expect(isLiveServerRunCommandCrash(1, null)).toBe(true);
    expect(isLiveServerRunCommandCrash(null, 'SIGTERM')).toBe(true);
  });
});

describe('liveServerRunCommandBackoffMs', () => {
  it('caps at the last backoff step', () => {
    expect(liveServerRunCommandBackoffMs(0)).toBe(1000);
    expect(liveServerRunCommandBackoffMs(1)).toBe(2000);
    expect(liveServerRunCommandBackoffMs(4)).toBe(16000);
    expect(liveServerRunCommandBackoffMs(99)).toBe(16000);
  });
});

describe('startLiveServerRunCommand', () => {
  it('spawns without a shell and reports running', async () => {
    nextMockChild();
    const onStatus = vi.fn();
    const handle = await startLiveServerRunCommand({
      command: '/usr/bin/node ./server.js',
      cwd: '/tmp/site',
      restartOnCrash: false,
      onStatus
    });
    expect(spawnMock).toHaveBeenCalledWith(
      '/usr/bin/node',
      ['./server.js'],
      expect.objectContaining({
        cwd: '/tmp/site',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
    );
    expect(onStatus).toHaveBeenCalledWith('running');
    await handle.stop();
  });

  it('resolves command variables before argv parse on start', async () => {
    nextMockChild();
    const resolveCommand = vi.fn((command: string) =>
      command.replace('{{node_bin}}', '/usr/bin/node')
    );
    const onStatus = vi.fn();
    const handle = await startLiveServerRunCommand({
      command: '{{node_bin}} ./server.js',
      cwd: '/tmp/site',
      restartOnCrash: false,
      resolveCommand,
      onStatus
    });
    expect(resolveCommand).toHaveBeenCalledWith('{{node_bin}} ./server.js');
    expect(spawnMock).toHaveBeenCalledWith(
      '/usr/bin/node',
      ['./server.js'],
      expect.objectContaining({ cwd: '/tmp/site' })
    );
    await handle.stop();
  });

  it('re-resolves command variables on crash restart', async () => {
    vi.useFakeTimers();
    const first = nextMockChild();
    const resolveCommand = vi
      .fn()
      .mockReturnValueOnce('/usr/bin/node ./server.js')
      .mockReturnValueOnce('/opt/node ./server.js');
    const onStatus = vi.fn();
    await startLiveServerRunCommand({
      command: '{{node_bin}} ./server.js',
      cwd: '/tmp',
      restartOnCrash: true,
      resolveCommand,
      onStatus
    });
    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      '/usr/bin/node',
      ['./server.js'],
      expect.anything()
    );

    first.closeWithCode(1);
    await Promise.resolve();
    nextMockChild();
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();

    expect(resolveCommand).toHaveBeenCalledTimes(2);
    expect(spawnMock).toHaveBeenNthCalledWith(2, '/opt/node', ['./server.js'], expect.anything());
  });

  it('does not restart on clean exit 0', async () => {
    const child = nextMockChild();
    const onStatus = vi.fn();
    await startLiveServerRunCommand({
      command: '/usr/bin/true',
      cwd: '/tmp',
      restartOnCrash: true,
      onStatus
    });
    child.closeWithCode(0);
    await Promise.resolve();
    expect(onStatus).toHaveBeenCalledWith('exited');
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('does not restart on intentional stop', async () => {
    const child = nextMockChild();
    const onStatus = vi.fn();
    const handle = await startLiveServerRunCommand({
      command: '/usr/bin/node server.js',
      cwd: '/tmp',
      restartOnCrash: true,
      onStatus
    });
    await handle.stop();
    expect(child.killed).toBe(true);
    expect(onStatus).toHaveBeenCalledWith('exited');
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('restarts on crash with backoff when restartOnCrash is true', async () => {
    vi.useFakeTimers();
    const first = nextMockChild();
    const onStatus = vi.fn();
    await startLiveServerRunCommand({
      command: '/usr/bin/node server.js',
      cwd: '/tmp',
      restartOnCrash: true,
      onStatus
    });
    first.closeWithCode(1);
    await Promise.resolve();
    expect(onStatus).toHaveBeenCalledWith(
      'restarting',
      expect.stringContaining('exited with code 1')
    );
    expect(spawnMock).toHaveBeenCalledTimes(1);

    const second = nextMockChild();
    await vi.advanceTimersByTimeAsync(1000);
    // Allow the restart spawn's microtask `spawn` event to flush.
    await Promise.resolve();
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenCalledWith('running');
    second.closeWithCode(0);
    await Promise.resolve();
  });

  it('marks failed on crash when restartOnCrash is false', async () => {
    const child = nextMockChild();
    const onStatus = vi.fn();
    await startLiveServerRunCommand({
      command: '/usr/bin/node server.js',
      cwd: '/tmp',
      restartOnCrash: false,
      onStatus
    });
    child.closeWithCode(2);
    await Promise.resolve();
    expect(onStatus).toHaveBeenCalledWith('failed', expect.stringContaining('exited with code 2'));
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('ignores exit from a superseded generation', async () => {
    vi.useFakeTimers();
    const first = nextMockChild();
    const onStatus = vi.fn();
    await startLiveServerRunCommand({
      command: '/usr/bin/node server.js',
      cwd: '/tmp',
      restartOnCrash: true,
      onStatus
    });
    first.closeWithCode(1);
    await Promise.resolve();
    const second = nextMockChild();
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(spawnMock).toHaveBeenCalledTimes(2);
    // Late close from the first generation must not schedule another restart.
    onStatus.mockClear();
    first.closeWithCode(1);
    await Promise.resolve();
    expect(onStatus).not.toHaveBeenCalled();
    second.closeWithCode(0);
    await Promise.resolve();
  });

  it('rejects when the initial spawn emits error', async () => {
    const child = new MockChild();
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }));
      });
      return child as unknown as ChildProcess;
    });
    const onStatus = vi.fn();
    await expect(
      startLiveServerRunCommand({
        command: '/missing/binary',
        cwd: '/tmp',
        restartOnCrash: false,
        onStatus
      })
    ).rejects.toThrow(/Failed to start run command/);
    expect(onStatus).toHaveBeenCalledWith('failed', expect.stringContaining('ENOENT'));
  });

  it('forwards stdout and stderr chunks via onOutput', async () => {
    const child = nextMockChild();
    const onStatus = vi.fn();
    const onOutput = vi.fn();
    const handle = await startLiveServerRunCommand({
      command: '/usr/bin/node server.js',
      cwd: '/tmp',
      restartOnCrash: false,
      onStatus,
      onOutput
    });
    child.stdout.emit('data', 'out-a');
    child.stderr.emit('data', Buffer.from('err-b'));
    expect(onOutput).toHaveBeenCalledWith('stdout', 'out-a');
    expect(onOutput).toHaveBeenCalledWith('stderr', 'err-b');
    await handle.stop();
  });
});
