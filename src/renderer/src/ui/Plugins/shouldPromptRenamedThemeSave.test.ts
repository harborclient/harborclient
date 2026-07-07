import { describe, expect, it } from 'vitest';
import { shouldPromptRenamedThemeSave } from '#/renderer/src/ui/Plugins/shouldPromptRenamedThemeSave';

describe('shouldPromptRenamedThemeSave', () => {
  it('returns false when no theme has been saved yet', () => {
    expect(shouldPromptRenamedThemeSave({ title: 'Default' }, { title: 'Ocean Breeze' })).toBe(
      false
    );
  });

  it('returns false when the title is unchanged', () => {
    expect(
      shouldPromptRenamedThemeSave(
        { id: 'theme-1', title: 'Ocean Breeze' },
        { id: 'theme-1', title: 'Ocean Breeze' }
      )
    ).toBe(false);
  });

  it('returns false when only whitespace differs', () => {
    expect(
      shouldPromptRenamedThemeSave(
        { id: 'theme-1', title: 'Ocean Breeze' },
        { id: 'theme-1', title: '  Ocean Breeze  ' }
      )
    ).toBe(false);
  });

  it('returns true when an existing theme title changed', () => {
    expect(
      shouldPromptRenamedThemeSave(
        { id: 'theme-1', title: 'Ocean Breeze' },
        { id: 'theme-1', title: 'Midnight Harbor' }
      )
    ).toBe(true);
  });
});
