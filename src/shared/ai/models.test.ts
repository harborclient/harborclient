import { describe, expect, it } from 'vitest';
import {
  AI_MODELS,
  getAiModelById,
  getAvailableModels,
  hasAvailableAiModels
} from '#/shared/ai/models';
import type { AiSettings, HubLlmModelGroup } from '#/shared/types';

const EMPTY_SETTINGS: AiSettings = {
  openaiApiKey: '',
  claudeApiKey: '',
  geminiApiKey: ''
};

const HUB_GROUPS: HubLlmModelGroup[] = [
  {
    hubId: 'hub-1',
    hubName: 'Team Hub',
    models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }],
    hasOpenAi: true
  }
];

describe('getAvailableModels', () => {
  it('returns no models when no API keys or hubs are configured', () => {
    expect(getAvailableModels(EMPTY_SETTINGS)).toEqual([]);
  });

  it('returns hub models with Team Hub labels when a hub offers them', () => {
    expect(getAvailableModels(EMPTY_SETTINGS, HUB_GROUPS)).toEqual([
      {
        id: 'gpt-4o',
        label: 'GPT-4o (Team Hub)',
        provider: 'openai',
        source: 'hub',
        hubId: 'hub-1',
        hubName: 'Team Hub'
      }
    ]);
  });

  it('returns hub-only models that are not in the static catalog', () => {
    const hubGroups: HubLlmModelGroup[] = [
      {
        hubId: 'hub-1',
        hubName: 'Team Hub',
        models: [{ id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' }],
        hasOpenAi: true
      }
    ];

    expect(getAvailableModels(EMPTY_SETTINGS, hubGroups)).toEqual([
      {
        id: 'gpt-4.1',
        label: 'GPT-4.1 (Team Hub)',
        provider: 'openai',
        source: 'hub',
        hubId: 'hub-1',
        hubName: 'Team Hub'
      }
    ]);
  });

  it('prefers hub models over personal keys for the same model id', () => {
    const models = getAvailableModels({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' }, HUB_GROUPS);
    const gpt4o = models.find((model) => model.id === 'gpt-4o');
    expect(gpt4o?.source).toBe('hub');
    expect(models.some((model) => model.id === 'gpt-4o-mini' && model.source === 'personal')).toBe(
      true
    );
  });

  it('returns personal models when no hub offers them', () => {
    const models = getAvailableModels({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' });
    expect(models.every((model) => model.provider === 'openai')).toBe(true);
    expect(models[0]?.source).toBe('personal');
    expect(models[0]?.label).toContain('(Personal)');
  });

  it('includes models from every provider with a configured key when hubs do not offer them', () => {
    const models = getAvailableModels(
      {
        openaiApiKey: 'sk-test',
        claudeApiKey: 'claude-key',
        geminiApiKey: 'gemini-key'
      },
      []
    );
    expect(models).toHaveLength(AI_MODELS.length);
  });
});

describe('hasAvailableAiModels', () => {
  it('returns true when hub models are available without personal keys', () => {
    expect(hasAvailableAiModels(EMPTY_SETTINGS, HUB_GROUPS)).toBe(true);
  });
});

describe('getAiModelById', () => {
  it('returns the catalog entry for a known model id', () => {
    expect(getAiModelById('gpt-4o')).toEqual(AI_MODELS[0]);
  });

  it('returns undefined for an unknown model id', () => {
    expect(getAiModelById('unknown-model')).toBeUndefined();
  });
});
