import { describe, expect, it } from 'vitest';
import terminalsReducer, {
  addTerminal,
  hydrateTerminals,
  removeTerminal,
  renameTerminal,
  setActiveTerminal,
  setTerminalSelection
} from '#/renderer/src/store/slices/terminalsSlice';

describe('terminalsSlice', () => {
  it('starts with no terminal tabs', () => {
    const state = terminalsReducer(undefined, { type: 'unknown' });
    expect(state.terminals).toEqual([]);
    expect(state.activeTerminalId).toBeNull();
    expect(state.selectionSnapshots).toEqual({});
    expect(state.terminalsHydrated).toBe(false);
  });

  it('adds a terminal tab and selects it', () => {
    const state = terminalsReducer(undefined, addTerminal());
    expect(state.terminals).toHaveLength(1);
    expect(state.terminals[0]?.title).toBe('Terminal 1');
    expect(state.activeTerminalId).toBe(state.terminals[0]?.id);
  });

  it('removes the active terminal and selects a neighbor', () => {
    let state = terminalsReducer(undefined, addTerminal());
    state = terminalsReducer(state, addTerminal());
    const firstId = state.terminals[0]?.id;
    const secondId = state.terminals[1]?.id;

    state = terminalsReducer(state, setActiveTerminal(secondId!));
    state = terminalsReducer(state, removeTerminal(secondId!));

    expect(state.terminals).toHaveLength(1);
    expect(state.activeTerminalId).toBe(firstId);
  });

  it('renames a terminal tab', () => {
    let state = terminalsReducer(undefined, addTerminal());
    const id = state.terminals[0]?.id;
    state = terminalsReducer(state, renameTerminal({ id: id!, title: 'Build shell' }));
    expect(state.terminals[0]?.title).toBe('Build shell');
  });

  it('keeps the previous title when rename input is blank or whitespace', () => {
    let state = terminalsReducer(undefined, addTerminal());
    const id = state.terminals[0]?.id;
    state = terminalsReducer(state, renameTerminal({ id: id!, title: 'Build shell' }));
    state = terminalsReducer(state, renameTerminal({ id: id!, title: '   ' }));
    expect(state.terminals[0]?.title).toBe('Build shell');
  });

  it('hydrates persisted terminal layout', () => {
    const state = terminalsReducer(
      undefined,
      hydrateTerminals({
        terminals: [{ id: 't-1', title: 'Saved', cwd: '' }],
        activeTerminalId: 't-1',
        selectionSnapshots: {}
      })
    );
    expect(state.terminals).toEqual([{ id: 't-1', title: 'Saved', cwd: '' }]);
    expect(state.activeTerminalId).toBe('t-1');
    expect(state.selectionSnapshots).toEqual({});
    expect(state.terminalsHydrated).toBe(true);
  });

  it('does not mark terminals hydrated when only adding a tab', () => {
    const state = terminalsReducer(undefined, addTerminal());
    expect(state.terminalsHydrated).toBe(false);
  });

  it('stores terminal selection snapshots keyed by reference token', () => {
    let state = terminalsReducer(undefined, addTerminal());
    state = terminalsReducer(
      state,
      setTerminalSelection({
        token: '@term.1#1.5',
        snapshot: {
          terminalLabel: 'Terminal 1',
          startLine: 1,
          endLine: 5,
          selectedText: 'error output',
          contextText: 'before\nerror output\nafter'
        }
      })
    );

    expect(state.selectionSnapshots['@term.1#1.5']).toEqual({
      terminalLabel: 'Terminal 1',
      startLine: 1,
      endLine: 5,
      selectedText: 'error output',
      contextText: 'before\nerror output\nafter'
    });
  });

  it('clears snapshots for the removed terminal index', () => {
    let state = terminalsReducer(undefined, addTerminal());
    state = terminalsReducer(state, addTerminal());
    state = terminalsReducer(
      state,
      setTerminalSelection({
        token: '@term.2#1.5',
        snapshot: {
          terminalLabel: 'Terminal 2',
          startLine: 1,
          endLine: 5,
          selectedText: 'error output',
          contextText: 'context'
        }
      })
    );

    const secondId = state.terminals[1]?.id;
    state = terminalsReducer(state, removeTerminal(secondId!));

    expect(state.selectionSnapshots['@term.2#1.5']).toBeUndefined();
  });
});
