import { describe, expect, it } from 'vitest';
import terminalsReducer, {
  addTerminal,
  hydrateTerminals,
  removeTerminal,
  renameTerminal,
  setActiveTerminal
} from '#/renderer/src/store/slices/terminalsSlice';

describe('terminalsSlice', () => {
  it('starts with no terminal tabs', () => {
    const state = terminalsReducer(undefined, { type: 'unknown' });
    expect(state.terminals).toEqual([]);
    expect(state.activeTerminalId).toBeNull();
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
        activeTerminalId: 't-1'
      })
    );
    expect(state.terminals).toEqual([{ id: 't-1', title: 'Saved', cwd: '' }]);
    expect(state.activeTerminalId).toBe('t-1');
  });
});
