import { describe, expect, it } from 'vitest';
import { defaultCanSubmitPromptValue } from './promptModal.logic.js';

describe('defaultCanSubmitPromptValue', () => {
  it('returns false for empty or whitespace-only values', () => {
    expect(defaultCanSubmitPromptValue('')).toBe(false);
    expect(defaultCanSubmitPromptValue('   ')).toBe(false);
    expect(defaultCanSubmitPromptValue('\n\t')).toBe(false);
  });

  it('returns true when trimmed value has content', () => {
    expect(defaultCanSubmitPromptValue('main')).toBe(true);
    expect(defaultCanSubmitPromptValue('  feature-branch  ')).toBe(true);
  });
});
