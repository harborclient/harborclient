import { describe, expect, it, vi } from 'vitest';
import { createLiveServerLineSplitter } from './liveServerLineSplitter';

describe('createLiveServerLineSplitter', () => {
  it('emits complete lines across chunk boundaries', () => {
    const onLine = vi.fn();
    const splitter = createLiveServerLineSplitter(onLine);
    splitter.push('hel');
    splitter.push('lo\nwor');
    splitter.push('ld\n');
    expect(onLine).toHaveBeenCalledTimes(2);
    expect(onLine).toHaveBeenNthCalledWith(1, 'hello');
    expect(onLine).toHaveBeenNthCalledWith(2, 'world');
  });

  it('handles CRLF and skips empty lines', () => {
    const onLine = vi.fn();
    const splitter = createLiveServerLineSplitter(onLine);
    splitter.push('a\r\n\r\nb\n');
    expect(onLine.mock.calls).toEqual([['a'], ['b']]);
  });

  it('flushes a trailing partial line without a newline', () => {
    const onLine = vi.fn();
    const splitter = createLiveServerLineSplitter(onLine);
    splitter.push('no-newline');
    expect(onLine).not.toHaveBeenCalled();
    splitter.flush();
    expect(onLine).toHaveBeenCalledWith('no-newline');
    splitter.flush();
    expect(onLine).toHaveBeenCalledTimes(1);
  });
});
