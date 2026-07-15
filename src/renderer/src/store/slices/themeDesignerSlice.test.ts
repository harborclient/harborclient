import { describe, expect, it } from 'vitest';
import type { CustomThemeDraft } from '#/renderer/src/ui/Tabs/Plugins/hooks/useCustomTheme';
import themeDesignerReducer, {
  beginEditSession,
  beginNewSession,
  clearSession,
  commitBaseline,
  initializeSession,
  recordImmediate,
  redo,
  resetToPersisted,
  selectThemeDesignerIsDirty,
  sessionSaved,
  setPresent,
  undo,
  type ThemeDesignerState
} from '#/renderer/src/store/slices/themeDesignerSlice';
import type { RootState } from '#/renderer/src/store/redux';

const baseDraft = (): CustomThemeDraft => ({
  id: 'my-theme',
  title: 'My Theme',
  type: 'dark',
  colors: { surface: '#111111', accent: '#0a84ff' }
});

/**
 * Builds a minimal RootState stub for theme designer selector tests.
 */
function rootStateWithThemeDesigner(themeDesigner: ThemeDesignerState): RootState {
  return { themeDesigner } as RootState;
}

describe('themeDesignerSlice', () => {
  it('starts with an empty uninitialized session', () => {
    const state = themeDesignerReducer(undefined, { type: 'unknown' });
    expect(state.editingId).toBeNull();
    expect(state.initialized).toBe(false);
    expect(state.activeThemeAtOpen).toBe('system');
  });

  it('begins an edit session and clears initialization until loaded', () => {
    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft: baseDraft(), activeTheme: 'custom:my-theme' })
    );
    expect(state.initialized).toBe(true);

    state = themeDesignerReducer(state, beginEditSession({ editingId: 'other-theme' }));
    expect(state.editingId).toBe('other-theme');
    expect(state.initialized).toBe(false);
  });

  it('begins a new session and clears initialization', () => {
    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft: baseDraft(), activeTheme: 'custom:my-theme' })
    );

    state = themeDesignerReducer(state, beginNewSession());
    expect(state.editingId).toBeNull();
    expect(state.initialized).toBe(false);
  });

  it('initializes a session with draft and active theme', () => {
    const draft = baseDraft();
    const state = themeDesignerReducer(
      undefined,
      initializeSession({ draft, activeTheme: 'custom:my-theme' })
    );

    expect(state.initialized).toBe(true);
    expect(state.history.present).toEqual(draft);
    expect(state.persistedDraft).toEqual(draft);
    expect(state.activeThemeAtOpen).toBe('custom:my-theme');
  });

  it('clears the session back to initial state', () => {
    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft: baseDraft(), activeTheme: 'custom:my-theme' })
    );

    state = themeDesignerReducer(state, clearSession());
    expect(state.editingId).toBeNull();
    expect(state.initialized).toBe(false);
    expect(state.activeThemeAtOpen).toBe('system');
  });

  it('updates persisted state after save', () => {
    const savedDraft: CustomThemeDraft = {
      id: 'saved-theme',
      title: 'Saved Theme',
      type: 'light',
      colors: { surface: '#ffffff' }
    };

    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft: baseDraft(), activeTheme: 'system' })
    );

    state = themeDesignerReducer(
      state,
      sessionSaved({ savedDraft, activeTheme: 'custom:saved-theme' })
    );

    expect(state.editingId).toBe('saved-theme');
    expect(state.history.present).toEqual(savedDraft);
    expect(state.persistedDraft).toEqual(savedDraft);
    expect(state.activeThemeAtOpen).toBe('custom:saved-theme');
    expect(state.initialized).toBe(true);
  });

  it('records immediate history steps and supports undo/redo', () => {
    const draft = baseDraft();
    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft, activeTheme: 'system' })
    );

    const edited: CustomThemeDraft = {
      ...draft,
      colors: { ...draft.colors, surface: '#222222' }
    };

    state = themeDesignerReducer(state, recordImmediate(edited));
    expect(state.history.present.colors.surface).toBe('#222222');
    expect(state.history.past).toHaveLength(1);

    state = themeDesignerReducer(state, undo());
    expect(state.history.present.colors.surface).toBe('#111111');

    state = themeDesignerReducer(state, redo());
    expect(state.history.present.colors.surface).toBe('#222222');
  });

  it('commits a debounced baseline to history', () => {
    const draft = baseDraft();
    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft, activeTheme: 'system' })
    );

    const baseline = draft;
    const edited: CustomThemeDraft = {
      ...draft,
      colors: { ...draft.colors, accent: '#ff0000' }
    };

    state = themeDesignerReducer(state, setPresent(edited));
    state = themeDesignerReducer(state, commitBaseline(baseline));

    expect(state.history.past).toHaveLength(1);
    expect(state.history.present.colors.accent).toBe('#ff0000');
  });

  it('resets history to the persisted snapshot', () => {
    const draft = baseDraft();
    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft, activeTheme: 'system' })
    );

    const edited: CustomThemeDraft = {
      ...draft,
      title: 'Changed title'
    };
    state = themeDesignerReducer(state, recordImmediate(edited));
    state = themeDesignerReducer(state, resetToPersisted());

    expect(state.history.present).toEqual(draft);
    expect(state.history.past).toHaveLength(0);
  });
});

describe('selectThemeDesignerIsDirty', () => {
  it('returns false when the session is not initialized', () => {
    const state = themeDesignerReducer(undefined, { type: 'unknown' });
    expect(selectThemeDesignerIsDirty(rootStateWithThemeDesigner(state))).toBe(false);
  });

  it('returns false when present matches the persisted snapshot', () => {
    const draft = baseDraft();
    const state = themeDesignerReducer(
      undefined,
      initializeSession({ draft, activeTheme: 'custom:my-theme' })
    );
    expect(selectThemeDesignerIsDirty(rootStateWithThemeDesigner(state))).toBe(false);
  });

  it('returns true when the draft has unsaved edits', () => {
    const draft = baseDraft();
    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft, activeTheme: 'custom:my-theme' })
    );
    state = themeDesignerReducer(
      state,
      setPresent({
        ...draft,
        colors: { ...draft.colors, accent: '#ff0000' }
      })
    );
    expect(selectThemeDesignerIsDirty(rootStateWithThemeDesigner(state))).toBe(true);
  });

  it('returns false after a successful save', () => {
    const draft = baseDraft();
    const savedDraft: CustomThemeDraft = {
      ...draft,
      colors: { ...draft.colors, accent: '#ff0000' }
    };
    let state = themeDesignerReducer(
      undefined,
      initializeSession({ draft, activeTheme: 'custom:my-theme' })
    );
    state = themeDesignerReducer(
      state,
      setPresent({
        ...draft,
        colors: { ...draft.colors, accent: '#ff0000' }
      })
    );
    state = themeDesignerReducer(
      state,
      sessionSaved({ savedDraft, activeTheme: 'custom:my-theme' })
    );
    expect(selectThemeDesignerIsDirty(rootStateWithThemeDesigner(state))).toBe(false);
  });
});
