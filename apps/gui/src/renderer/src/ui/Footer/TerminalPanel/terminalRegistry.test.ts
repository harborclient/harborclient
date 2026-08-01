import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchAddon } from '@xterm/addon-search';
import type { Terminal } from '@xterm/xterm';
import {
  clearTerminalRegistry,
  getTerminalInstance,
  getTerminalSearchAddon,
  registerTerminalInstance,
  registerTerminalSearchAddon,
  unregisterTerminalInstance
} from './terminalRegistry';

/**
 * Builds a minimal xterm-like terminal stub for registry tests.
 *
 * @returns Empty terminal stub.
 */
function terminalStub(): Terminal {
  return {} as Terminal;
}

/**
 * Builds a minimal search-addon stub for registry tests.
 *
 * @returns Search addon stub with a clearDecorations spy.
 */
function searchAddonStub(): SearchAddon {
  return {
    clearDecorations: vi.fn()
  } as unknown as SearchAddon;
}

describe('terminalRegistry', () => {
  /**
   * Clears registry maps so tests do not leak across cases.
   */
  afterEach(() => {
    clearTerminalRegistry();
  });

  it('registers and returns a live terminal instance by id', () => {
    const terminal = terminalStub();
    registerTerminalInstance('term-1', terminal);

    expect(getTerminalInstance('term-1')).toBe(terminal);
  });

  it('returns undefined for unknown terminal ids', () => {
    expect(getTerminalInstance('missing')).toBeUndefined();
    expect(getTerminalSearchAddon('missing')).toBeUndefined();
  });

  it('registers a search addon only after the terminal instance exists', () => {
    const searchAddon = searchAddonStub();
    registerTerminalSearchAddon('term-1', searchAddon);
    expect(getTerminalSearchAddon('term-1')).toBeUndefined();

    registerTerminalInstance('term-1', terminalStub());
    registerTerminalSearchAddon('term-1', searchAddon);
    expect(getTerminalSearchAddon('term-1')).toBe(searchAddon);
  });

  it('unregisters a terminal instance and clears search decorations on dispose', () => {
    const terminal = terminalStub();
    const searchAddon = searchAddonStub();
    registerTerminalInstance('term-2', terminal);
    registerTerminalSearchAddon('term-2', searchAddon);
    unregisterTerminalInstance('term-2');

    expect(getTerminalInstance('term-2')).toBeUndefined();
    expect(getTerminalSearchAddon('term-2')).toBeUndefined();
    expect(searchAddon.clearDecorations).toHaveBeenCalledOnce();
  });
});
