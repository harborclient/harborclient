import { describe, expect, it } from 'vitest';
import { hasConfiguredAiApiKeys } from '#/shared/aiSettings';
import type { AiSettings } from '#/shared/types';

const EMPTY_SETTINGS: AiSettings = {
  openaiApiKey: '',
  claudeApiKey: '',
  geminiApiKey: ''
};

describe('hasConfiguredAiApiKeys', () => {
  it('returns false when all keys are empty', () => {
    expect(hasConfiguredAiApiKeys(EMPTY_SETTINGS)).toBe(false);
  });

  it('returns false when keys contain only whitespace', () => {
    expect(
      hasConfiguredAiApiKeys({
        openaiApiKey: '   ',
        claudeApiKey: '\t',
        geminiApiKey: ' \n '
      })
    ).toBe(false);
  });

  it('returns true when any provider key is non-empty after trim', () => {
    expect(hasConfiguredAiApiKeys({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' })).toBe(true);
    expect(hasConfiguredAiApiKeys({ ...EMPTY_SETTINGS, claudeApiKey: 'claude-key' })).toBe(true);
    expect(hasConfiguredAiApiKeys({ ...EMPTY_SETTINGS, geminiApiKey: 'gemini-key' })).toBe(true);
  });
});
