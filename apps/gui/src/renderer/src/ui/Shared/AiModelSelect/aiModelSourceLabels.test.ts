import { describe, expect, it } from 'vitest';
import { getAvailableModels, type AiModelOption } from '@harborclient/core/ai/models';
import type { AiSettings, HubLlmModelGroup } from '@harborclient/core/types';
import { getAiModelSelectAriaLabel, shouldShowAiModelSourceLabels } from './aiModelSourceLabels';

const EMPTY_SETTINGS: AiSettings = {
  openaiApiKey: '',
  claudeApiKey: '',
  geminiApiKey: ''
};

const SINGLE_HUB: HubLlmModelGroup[] = [
  {
    hubId: 'hub-1',
    hubName: 'Sean (OVH)',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' }
    ],
    hasOpenAi: true
  }
];

const TWO_HUBS: HubLlmModelGroup[] = [
  {
    hubId: 'hub-a',
    hubName: 'Alpha Hub',
    models: [{ id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' }],
    hasOpenAi: true
  },
  {
    hubId: 'hub-b',
    hubName: 'Beta Hub',
    models: [{ id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai' }],
    hasOpenAi: true
  }
];

describe('shouldShowAiModelSourceLabels', () => {
  it('hides labels when only personal API keys are configured', () => {
    const models = getAvailableModels({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' });

    expect(shouldShowAiModelSourceLabels(models)).toBe(false);
  });

  it('hides labels when models come from a single Team Hub', () => {
    const models = getAvailableModels(EMPTY_SETTINGS, SINGLE_HUB);

    expect(shouldShowAiModelSourceLabels(models)).toBe(false);
  });

  it('shows labels when a hub and personal keys are both present', () => {
    const models = getAvailableModels({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' }, SINGLE_HUB);

    expect(shouldShowAiModelSourceLabels(models)).toBe(true);
  });

  it('shows labels when more than one Team Hub is connected', () => {
    const models = getAvailableModels(EMPTY_SETTINGS, TWO_HUBS);

    expect(shouldShowAiModelSourceLabels(models)).toBe(true);
  });
});

describe('getAiModelSelectAriaLabel', () => {
  it('returns a bare label when no model is selected', () => {
    const models = getAvailableModels({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' });

    expect(getAiModelSelectAriaLabel(models, null)).toBe('AI model');
    expect(getAiModelSelectAriaLabel(models, undefined)).toBe('AI model');
  });

  it('omits the source when there is a single source', () => {
    const models = getAvailableModels(EMPTY_SETTINGS, SINGLE_HUB);
    const selected = models[0] as AiModelOption;

    expect(getAiModelSelectAriaLabel(models, selected)).toBe(`AI model, ${selected.label}`);
  });

  it('includes the source when there are multiple sources', () => {
    const models = getAvailableModels({ ...EMPTY_SETTINGS, openaiApiKey: 'sk-test' }, SINGLE_HUB);
    const hubModel = models.find((model) => model.source === 'hub') as AiModelOption;

    expect(getAiModelSelectAriaLabel(models, hubModel)).toBe(
      `AI model, ${hubModel.label}, Sean (OVH)`
    );
  });
});
