import { describe, expect, it } from 'vitest';
import type { CustomThemeDraft } from './useCustomTheme';
import {
  cloneCustomThemeDraft,
  commitThemeHistoryBaseline,
  createThemeHistoryState,
  customThemeDraftsEqual,
  recordThemeHistoryImmediate,
  redoThemeHistory,
  resetThemeHistory,
  setThemeHistoryPresent,
  undoThemeHistory
} from './themeHistoryStack';

/**
 * Builds a minimal Designer draft for history tests.
 *
 * @param overrides - Partial draft fields to apply.
 * @returns Draft snapshot used in assertions.
 */
function buildDraft(overrides: Partial<CustomThemeDraft> = {}): CustomThemeDraft {
  return {
    title: 'Test Theme',
    type: 'light',
    colors: {
      accent: '#111111',
      surface: '#222222'
    },
    ...overrides
  };
}

describe('customThemeDraftsEqual', () => {
  it('returns true for drafts with matching fields and colors', () => {
    const left = buildDraft();
    const right = buildDraft();
    expect(customThemeDraftsEqual(left, right)).toBe(true);
  });

  it('returns false when a color token changes', () => {
    const left = buildDraft();
    const right = buildDraft({ colors: { accent: '#999999', surface: '#222222' } });
    expect(customThemeDraftsEqual(left, right)).toBe(false);
  });
});

describe('recordThemeHistoryImmediate', () => {
  it('pushes the previous present value to past and clears future', () => {
    const initial = buildDraft({ title: 'Before' });
    const next = buildDraft({ title: 'After' });
    const state = createThemeHistoryState(initial);
    const updated = recordThemeHistoryImmediate(state, next);

    expect(updated.present.title).toBe('After');
    expect(updated.past).toHaveLength(1);
    expect(updated.past[0]?.title).toBe('Before');
    expect(updated.future).toHaveLength(0);
  });

  it('does not grow past when the next draft is equal', () => {
    const initial = buildDraft();
    const state = createThemeHistoryState(initial);
    const updated = recordThemeHistoryImmediate(state, buildDraft());
    expect(updated.past).toHaveLength(0);
  });
});

describe('undoThemeHistory and redoThemeHistory', () => {
  it('restores the previous draft and preserves redo steps', () => {
    const initial = buildDraft({ title: 'One' });
    const second = buildDraft({ title: 'Two' });
    let state = createThemeHistoryState(initial);
    state = recordThemeHistoryImmediate(state, second);

    const undone = undoThemeHistory(state);
    expect(undone?.present.title).toBe('One');
    expect(undone?.future[0]?.title).toBe('Two');

    const redone = redoThemeHistory(undone!);
    expect(redone?.present.title).toBe('Two');
    expect(redone?.past[0]?.title).toBe('One');
  });

  it('returns null when undo or redo is unavailable', () => {
    const state = createThemeHistoryState(buildDraft());
    expect(undoThemeHistory(state)).toBeNull();
    expect(redoThemeHistory(state)).toBeNull();
  });
});

describe('commitThemeHistoryBaseline', () => {
  it('records the captured baseline when present changed during debounce', () => {
    const baseline = buildDraft({ colors: { accent: '#111111', surface: '#222222' } });
    const present = buildDraft({ colors: { accent: '#333333', surface: '#222222' } });
    const state = setThemeHistoryPresent(createThemeHistoryState(baseline), present);
    const updated = commitThemeHistoryBaseline(state, baseline);

    expect(updated.past).toHaveLength(1);
    expect(updated.past[0]?.colors.accent).toBe('#111111');
    expect(updated.present.colors.accent).toBe('#333333');
  });
});

describe('cloneCustomThemeDraft and resetThemeHistory', () => {
  it('clones color maps independently', () => {
    const draft = buildDraft();
    const clone = cloneCustomThemeDraft(draft);
    clone.colors.accent = '#000000';
    expect(draft.colors.accent).toBe('#111111');
  });

  it('clears past and future on reset', () => {
    let state = createThemeHistoryState(buildDraft({ title: 'One' }));
    state = recordThemeHistoryImmediate(state, buildDraft({ title: 'Two' }));
    expect(state.past).toHaveLength(1);
    const reset = resetThemeHistory(buildDraft({ title: 'Fresh' }));

    expect(reset.present.title).toBe('Fresh');
    expect(reset.past).toHaveLength(0);
    expect(reset.future).toHaveLength(0);
  });
});
