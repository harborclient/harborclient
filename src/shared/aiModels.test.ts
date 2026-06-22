import { describe, expect, it } from 'vitest';
import { AI_MODELS, getAvailableModels } from '#/shared/aiModels';
import type { AiSettings } from '#/shared/types';

const EMPTY_SETTINGS: AiSettings = {
  openaiApiKey: '',
  claudeApiKey: '',
  geminiApiKey: ''
};

describe('getAvailableModels', () => {
  it('returns no models when no API keys are configured', () => {
    expect(getAvailableModels(EMPTY_SETTINGS)).toEqual([]);
  });

  it('returns only OpenAI models when an OpenAI key is set', () => {
    const models = getAvailableModels({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' });
    expect(models.every((model) => model.provider === 'openai')).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it('includes models from every provider with a configured key', () => {
    const models = getAvailableModels({
      openaiApiKey: 'sk-test',
      claudeApiKey: 'claude-key',
      geminiApiKey: 'gemini-key'
    });
    expect(models).toEqual(AI_MODELS);
  });
});
