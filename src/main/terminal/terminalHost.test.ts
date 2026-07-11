import { beforeEach, describe, expect, it, vi } from 'vitest';

type DataHandler = (data: string) => void;
type ExitHandler = (event: { exitCode: number }) => void;

const ptyInstances: Array<{
  dataHandler: DataHandler | null;
  exitHandler: ExitHandler | null;
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => {
    const instance = {
      dataHandler: null as DataHandler | null,
      exitHandler: null as ExitHandler | null,
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData(handler: DataHandler) {
        instance.dataHandler = handler;
      },
      onExit(handler: ExitHandler) {
        instance.exitHandler = handler;
      }
    };
    ptyInstances.push(instance);
    return instance;
  })
}));

import {
  createTerminal,
  killAllTerminals,
  killTerminal,
  resizeTerminal,
  writeTerminal
} from '#/main/terminal/terminalHost';

describe('terminalHost', () => {
  beforeEach(() => {
    ptyInstances.length = 0;
    killAllTerminals();
  });

  it('creates a terminal session and streams output to webContents', () => {
    const send = vi.fn();
    const webContents = {
      isDestroyed: () => false,
      send
    } as never;

    const result = createTerminal({ id: 'term-1', cols: 80, rows: 24 }, webContents);
    expect(result.id).toBe('term-1');
    expect(ptyInstances).toHaveLength(1);

    ptyInstances[0]?.dataHandler?.('hello');
    expect(send).toHaveBeenCalledWith('terminal:data', { id: 'term-1', data: 'hello' });
  });

  it('writes stdin data to the active session', () => {
    const webContents = {
      isDestroyed: () => false,
      send: vi.fn()
    } as never;

    createTerminal({ id: 'term-1', cols: 80, rows: 24 }, webContents);
    writeTerminal('term-1', 'ls\n');
    expect(ptyInstances[0]?.write).toHaveBeenCalledWith('ls\n');
  });

  it('kills one terminal session', () => {
    const webContents = {
      isDestroyed: () => false,
      send: vi.fn()
    } as never;

    createTerminal({ id: 'term-1', cols: 80, rows: 24 }, webContents);
    killTerminal('term-1');
    expect(ptyInstances[0]?.kill).toHaveBeenCalled();
  });

  it('resizes an active terminal session', () => {
    const webContents = {
      isDestroyed: () => false,
      send: vi.fn()
    } as never;

    createTerminal({ id: 'term-1', cols: 80, rows: 24 }, webContents);
    resizeTerminal('term-1', 120, 40);
    expect(ptyInstances[0]?.resize).toHaveBeenCalledWith(120, 40);
  });

  it('does not emit exit events for stale sessions replaced by createTerminal', () => {
    const send = vi.fn();
    const webContents = {
      isDestroyed: () => false,
      send
    } as never;

    createTerminal({ id: 'term-1', cols: 80, rows: 24 }, webContents);
    const firstInstance = ptyInstances[0];
    expect(firstInstance).toBeDefined();

    createTerminal({ id: 'term-1', cols: 80, rows: 24 }, webContents);
    expect(ptyInstances).toHaveLength(2);

    firstInstance?.exitHandler?.({ exitCode: 0 });
    expect(send).not.toHaveBeenCalledWith('terminal:exit', expect.anything());
  });

  it('does not emit exit events after killTerminal removes the session', () => {
    const send = vi.fn();
    const webContents = {
      isDestroyed: () => false,
      send
    } as never;

    createTerminal({ id: 'term-1', cols: 80, rows: 24 }, webContents);
    const instance = ptyInstances[0];
    killTerminal('term-1');

    instance?.exitHandler?.({ exitCode: 0 });
    expect(send).not.toHaveBeenCalledWith('terminal:exit', expect.anything());
  });
});
