import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { nanoid } from 'nanoid';
import type { TerminalSelectionSnapshot } from '#/shared/ai/scriptReferences';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Persisted metadata for one footer terminal tab.
 */
export interface TerminalTab {
  /**
   * Stable tab id used by Redux, persistence, and IPC.
   */
  id: string;

  /**
   * Display label shown in the vertical terminal switcher.
   */
  title: string;

  /**
   * Working directory for the shell; blank values use the user home directory.
   */
  cwd: string;
}

/**
 * Footer terminal layout state persisted across app restarts.
 */
export interface TerminalsState {
  /**
   * Ordered terminal tabs.
   */
  terminals: TerminalTab[];

  /**
   * Active terminal tab id, if any.
   */
  activeTerminalId: string | null;

  /**
   * Terminal selection snapshots keyed by `@term` reference token.
   */
  selectionSnapshots: Record<string, TerminalSelectionSnapshot>;

  /**
   * Whether persisted terminal layout has been loaded from storage.
   */
  terminalsHydrated: boolean;
}

/**
 * Payload for restoring terminal layout after reading persisted storage.
 */
export type HydrateTerminalsPayload = Pick<
  TerminalsState,
  'terminals' | 'activeTerminalId' | 'selectionSnapshots'
>;

const initialState: TerminalsState = {
  terminals: [],
  activeTerminalId: null,
  selectionSnapshots: {},
  terminalsHydrated: false
};

/**
 * Builds the next default terminal title based on existing tab count.
 *
 * @param count - Number of terminals already present.
 * @returns A human-readable default title.
 */
function defaultTerminalTitle(count: number): string {
  return `Terminal ${count + 1}`;
}

const terminalsSlice = createSlice({
  name: 'terminals',
  initialState,
  reducers: {
    /**
     * Replaces terminal layout state after hydration from localStorage.
     */
    hydrateTerminals(state, action: PayloadAction<HydrateTerminalsPayload>) {
      state.terminals = action.payload.terminals;
      state.activeTerminalId = action.payload.activeTerminalId;
      state.selectionSnapshots = action.payload.selectionSnapshots ?? {};
      state.terminalsHydrated = true;
    },

    /**
     * Adds a new terminal tab and selects it.
     *
     * Optional `cwd` sets the shell working directory; blank values use the home directory.
     */
    addTerminal: {
      reducer(state, action: PayloadAction<{ cwd: string }>) {
        const tab: TerminalTab = {
          id: nanoid(),
          title: defaultTerminalTitle(state.terminals.length),
          cwd: action.payload.cwd
        };
        state.terminals.push(tab);
        state.activeTerminalId = tab.id;
      },
      /**
       * Normalizes an optional working directory for a new terminal tab.
       *
       * @param options - Optional cwd for the new shell session.
       * @returns Action payload with a trimmed cwd string.
       */
      prepare(options?: { cwd?: string }) {
        return { payload: { cwd: options?.cwd?.trim() ?? '' } };
      }
    },

    /**
     * Removes one terminal tab and selects a neighboring tab when needed.
     */
    removeTerminal(state, action: PayloadAction<string>) {
      const index = state.terminals.findIndex((terminal) => terminal.id === action.payload);
      if (index < 0) {
        return;
      }

      const removedIndex = index + 1;
      state.terminals.splice(index, 1);

      for (const token of Object.keys(state.selectionSnapshots)) {
        const match = token.match(/^@term\.(\d+)#/);
        if (match != null && Number(match[1]) === removedIndex) {
          delete state.selectionSnapshots[token];
        }
      }

      if (state.activeTerminalId !== action.payload) {
        return;
      }

      const next = state.terminals[index] ?? state.terminals[index - 1] ?? null;
      state.activeTerminalId = next?.id ?? null;
    },

    /**
     * Selects one terminal tab in the vertical switcher.
     */
    setActiveTerminal(state, action: PayloadAction<string>) {
      if (state.terminals.some((terminal) => terminal.id === action.payload)) {
        state.activeTerminalId = action.payload;
      }
    },

    /**
     * Renames one terminal tab.
     */
    renameTerminal(state, action: PayloadAction<{ id: string; title: string }>) {
      const terminal = state.terminals.find((entry) => entry.id === action.payload.id);
      if (!terminal) {
        return;
      }

      const title = action.payload.title.trim();
      terminal.title = title.length > 0 ? title : terminal.title;
    },

    /**
     * Updates the working directory for a terminal tab, respawning the PTY on next attach.
     *
     * When `id` is omitted, updates the active terminal tab.
     *
     * @param state - Terminals slice state.
     * @param action - Target tab id (optional) and new working directory.
     */
    setTerminalCwd(state, action: PayloadAction<{ id?: string; cwd: string }>) {
      const targetId = action.payload.id ?? state.activeTerminalId;
      if (targetId == null) {
        return;
      }

      const terminal = state.terminals.find((entry) => entry.id === targetId);
      if (!terminal) {
        return;
      }

      terminal.cwd = action.payload.cwd.trim();
    },

    /**
     * Stores a terminal selection snapshot for an `@term` reference token.
     */
    setTerminalSelection(
      state,
      action: PayloadAction<{ token: string; snapshot: TerminalSelectionSnapshot }>
    ) {
      state.selectionSnapshots[action.payload.token] = action.payload.snapshot;
    }
  }
});

export const {
  hydrateTerminals,
  addTerminal,
  removeTerminal,
  setActiveTerminal,
  renameTerminal,
  setTerminalCwd,
  setTerminalSelection
} = terminalsSlice.actions;

/**
 * Returns all footer terminal tabs.
 */
export const selectTerminals = (state: RootState): TerminalTab[] => state.terminals.terminals;

/**
 * Returns the active footer terminal tab id, if any.
 */
export const selectActiveTerminalId = (state: RootState): string | null =>
  state.terminals.activeTerminalId;

/**
 * Returns the active footer terminal tab, if any.
 */
export const selectActiveTerminal = (state: RootState): TerminalTab | null => {
  const activeId = state.terminals.activeTerminalId;
  if (activeId == null) {
    return null;
  }

  return state.terminals.terminals.find((terminal) => terminal.id === activeId) ?? null;
};

/**
 * Returns terminal selection snapshots keyed by `@term` reference token.
 */
export const selectTerminalSelections = (
  state: RootState
): Record<string, TerminalSelectionSnapshot> => state.terminals.selectionSnapshots;

/**
 * Returns whether persisted terminal layout has been loaded.
 */
export const selectTerminalsHydrated = (state: RootState): boolean =>
  state.terminals.terminalsHydrated;

export default terminalsSlice.reducer;
