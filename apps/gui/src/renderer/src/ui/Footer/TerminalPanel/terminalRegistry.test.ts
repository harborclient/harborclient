import { describe, expect, it } from 'vitest';
import type { Terminal } from '@xterm/xterm';
import {
  getTerminalInstance,
  registerTerminalInstance,
  unregisterTerminalInstance
} from './terminalRegistry';

/**
 * Builds a minimal xterm-like terminal stub for registry tests.
 */
function terminalStub(): Terminal {
  return {} as Terminal;
}

describe('terminalRegistry', () => {
  it('registers and returns a live terminal instance by id', () => {
    const terminal = terminalStub();
    registerTerminalInstance('term-1', terminal);

    expect(getTerminalInstance('term-1')).toBe(terminal);
  });

  it('returns undefined for unknown terminal ids', () => {
    expect(getTerminalInstance('missing')).toBeUndefined();
  });

  it('unregisters a terminal instance on dispose', () => {
    const terminal = terminalStub();
    registerTerminalInstance('term-2', terminal);
    unregisterTerminalInstance('term-2');

    expect(getTerminalInstance('term-2')).toBeUndefined();
  });
});
