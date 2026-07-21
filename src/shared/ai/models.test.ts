import { describe, expect, it } from 'vitest';
import {
  AI_MODELS,
  GITHUB_MODELS,
  getAiModelById,
  getAvailableModels,
  hasAvailableAiModels
} from './models';
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
        value: 'gpt-4o',
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
        value: 'gpt-4.1',
        label: 'GPT-4.1 (Team Hub)',
        provider: 'openai',
        source: 'hub',
        hubId: 'hub-1',
        hubName: 'Team Hub'
      }
    ]);
  });

  it('surfaces both the hub and personal entries for a shared model id', () => {
    const models = getAvailableModels({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' }, HUB_GROUPS);

    const hubGpt4o = models.find((model) => model.value === 'gpt-4o');
    expect(hubGpt4o?.source).toBe('hub');

    const personalGpt4o = models.find((model) => model.value === 'personal:gpt-4o');
    expect(personalGpt4o?.source).toBe('personal');
    expect(personalGpt4o?.id).toBe('gpt-4o');
    expect(personalGpt4o?.label).toContain('(Personal)');

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

  it('returns GitHub Models when sign-in is connected', () => {
    const models = getAvailableModels(EMPTY_SETTINGS, [], true);
    expect(models).toHaveLength(GITHUB_MODELS.length);
    expect(models.every((model) => model.provider === 'github')).toBe(true);
    expect(models[0]?.label).toContain('(GitHub Models)');
  });
});

describe('hasAvailableAiModels', () => {
  it('returns true when hub models are available without personal keys', () => {
    expect(hasAvailableAiModels(EMPTY_SETTINGS, HUB_GROUPS)).toBe(true);
  });

  it('returns true when only GitHub Models is connected', () => {
    expect(hasAvailableAiModels(EMPTY_SETTINGS, [], true)).toBe(true);
  });
});

describe('getAiModelById', () => {
  it('returns the catalog entry for a known model id', () => {
    expect(getAiModelById('gpt-4o')).toEqual(AI_MODELS[0]);
  });

  it('returns GitHub Models catalog entries', () => {
    expect(getAiModelById('openai/gpt-4o')).toEqual(GITHUB_MODELS[0]);
  });

  it('returns undefined for an unknown model id', () => {
    expect(getAiModelById('unknown-model')).toBeUndefined();
  });
});
