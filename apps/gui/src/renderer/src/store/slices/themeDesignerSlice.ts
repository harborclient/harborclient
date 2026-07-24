import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '#/renderer/src/store/redux';
import {
  DEFAULT_CUSTOM_THEME_TITLE,
  getDefaultCustomThemePalette
} from '#/renderer/src/ui/Tabs/Plugins/customThemeDefaults';
import type { CustomThemeDraft } from '#/renderer/src/ui/Tabs/Plugins/hooks/useCustomTheme';
import {
  commitThemeHistoryBaseline,
  createThemeHistoryState,
  customThemeDraftsEqual,
  recordThemeHistoryImmediate,
  redoThemeHistory,
  resetThemeHistory,
  setThemeHistoryPresent,
  undoThemeHistory,
  type ThemeHistoryState
} from '#/renderer/src/ui/Tabs/Plugins/hooks/themeHistoryStack';

/**
 * Redux state for the Theme Designer session, preserved across Themes tab unmounts.
 */
export interface ThemeDesignerState {
  /**
   * Custom theme filename stem under edit, or null for a new theme draft.
   */
  editingId: string | null;

  /**
   * Whether the draft has been loaded or seeded for the current editing session.
   */
  initialized: boolean;

  /**
   * Undo/redo history for the Designer draft.
   */
  history: ThemeHistoryState;

  /**
   * Last saved or loaded snapshot used for dirty detection and discard.
   */
  persistedDraft: CustomThemeDraft;

  /**
   * Active theme preference captured when the session opened, used to restore preview on leave.
   */
  activeThemeAtOpen: string;
}

const emptyDraft = (): CustomThemeDraft => ({
  title: DEFAULT_CUSTOM_THEME_TITLE,
  type: 'light',
  colors: getDefaultCustomThemePalette('light')
});

const initialState: ThemeDesignerState = {
  editingId: null,
  initialized: false,
  history: createThemeHistoryState(emptyDraft()),
  persistedDraft: emptyDraft(),
  activeThemeAtOpen: 'system'
};

const themeDesignerSlice = createSlice({
  name: 'themeDesigner',
  initialState,
  reducers: {
    /**
     * Starts editing an existing custom theme, discarding any prior in-progress draft.
     */
    beginEditSession(state, action: PayloadAction<{ editingId: string }>) {
      state.editingId = action.payload.editingId;
      state.initialized = false;
    },

    /**
     * Starts a new blank theme draft, discarding any prior in-progress draft.
     */
    beginNewSession(state) {
      state.editingId = null;
      state.initialized = false;
    },

    /**
     * Seeds the session after loading or creating the initial draft snapshot.
     */
    initializeSession(
      state,
      action: PayloadAction<{ draft: CustomThemeDraft; activeTheme: string }>
    ) {
      state.history = resetThemeHistory(action.payload.draft);
      state.persistedDraft = action.payload.draft;
      state.activeThemeAtOpen = action.payload.activeTheme;
      state.initialized = true;
    },

    /**
     * Clears the Designer session when leaving Designer or closing the Themes tab.
     */
    clearSession() {
      return initialState;
    },

    /**
     * Updates persisted state after a successful save.
     */
    sessionSaved(
      state,
      action: PayloadAction<{ savedDraft: CustomThemeDraft; activeTheme: string }>
    ) {
      state.editingId = action.payload.savedDraft.id ?? null;
      state.history = resetThemeHistory(action.payload.savedDraft);
      state.persistedDraft = action.payload.savedDraft;
      state.activeThemeAtOpen = action.payload.activeTheme;
      state.initialized = true;
    },

    /**
     * Updates the present draft without recording a new undo step.
     */
    setPresent(state, action: PayloadAction<CustomThemeDraft>) {
      state.history = setThemeHistoryPresent(state.history, action.payload);
    },

    /**
     * Records a draft change immediately, pushing the previous present value to past.
     */
    recordImmediate(state, action: PayloadAction<CustomThemeDraft>) {
      state.history = recordThemeHistoryImmediate(state.history, action.payload);
    },

    /**
     * Commits a debounced baseline snapshot to the undo stack.
     */
    commitBaseline(state, action: PayloadAction<CustomThemeDraft>) {
      state.history = commitThemeHistoryBaseline(state.history, action.payload);
    },

    /**
     * Moves one step backward in history when available.
     */
    undo(state) {
      const next = undoThemeHistory(state.history);
      if (next != null) {
        state.history = next;
      }
    },

    /**
     * Moves one step forward in history when available.
     */
    redo(state) {
      const next = redoThemeHistory(state.history);
      if (next != null) {
        state.history = next;
      }
    },

    /**
     * Resets the history stack to the persisted snapshot without clearing the session.
     */
    resetToPersisted(state) {
      state.history = resetThemeHistory(state.persistedDraft);
    }
  }
});

export const {
  beginEditSession,
  beginNewSession,
  initializeSession,
  clearSession,
  sessionSaved,
  setPresent,
  recordImmediate,
  commitBaseline,
  undo,
  redo,
  resetToPersisted
} = themeDesignerSlice.actions;

/**
 * Returns whether the Designer session has been initialized with a draft.
 */
export const selectThemeDesignerInitialized = (state: RootState): boolean =>
  state.themeDesigner.initialized;

/**
 * Returns the custom theme id under edit, if any.
 */
export const selectThemeDesignerEditingId = (state: RootState): string | null =>
  state.themeDesigner.editingId;

/**
 * Returns the current Designer draft from history.
 */
export const selectThemeDesignerDraft = (state: RootState): CustomThemeDraft =>
  state.themeDesigner.history.present;

/**
 * Returns the last saved or loaded Designer draft snapshot.
 */
export const selectThemeDesignerPersistedDraft = (state: RootState): CustomThemeDraft =>
  state.themeDesigner.persistedDraft;

/**
 * Returns the active theme preference captured when the session opened.
 */
export const selectThemeDesignerActiveThemeAtOpen = (state: RootState): string =>
  state.themeDesigner.activeThemeAtOpen;

/**
 * Returns whether an undo step is available in the Designer history.
 */
export const selectThemeDesignerCanUndo = (state: RootState): boolean =>
  state.themeDesigner.history.past.length > 0;

/**
 * Returns whether a redo step is available in the Designer history.
 */
export const selectThemeDesignerCanRedo = (state: RootState): boolean =>
  state.themeDesigner.history.future.length > 0;

/**
 * Returns whether the Designer has unsaved edits relative to the persisted snapshot.
 */
export const selectThemeDesignerIsDirty = (state: RootState): boolean =>
  state.themeDesigner.initialized &&
  !customThemeDraftsEqual(state.themeDesigner.history.present, state.themeDesigner.persistedDraft);

export default themeDesignerSlice.reducer;
