import { describe, expect, it } from 'vitest';
import { parseScriptAskModelSpec, resolveScriptAskModel } from './resolveScriptAskModel';
import type { AiSettings, HubLlmModelGroup } from '../types';

const EMPTY_SETTINGS: AiSettings = {
  openaiApiKey: '',
  claudeApiKey: '',
  geminiApiKey: ''
};

const PERSONAL_SETTINGS: AiSettings = {
  ...EMPTY_SETTINGS,
  openaiApiKey: 'sk-test'
};

const HUB_GROUPS: HubLlmModelGroup[] = [
  {
    hubId: 'hub-1',
    hubName: 'Sean (Team Hub)',
    models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }],
    hasOpenAi: true
  }
];

describe('parseScriptAskModelSpec', () => {
  it('returns empty object for missing or blank specs', () => {
    expect(parseScriptAskModelSpec(undefined)).toEqual({});
    expect(parseScriptAskModelSpec('')).toEqual({});
    expect(parseScriptAskModelSpec('   ')).toEqual({});
  });

  it('parses model-only and model+source specs', () => {
    expect(parseScriptAskModelSpec('gpt-4o')).toEqual({ model: 'gpt-4o' });
    expect(parseScriptAskModelSpec('gpt-4o: personal')).toEqual({
      model: 'gpt-4o',
      source: 'personal'
    });
    expect(parseScriptAskModelSpec(' GPT-4o Mini : Personal ')).toEqual({
      model: 'GPT-4o Mini',
      source: 'Personal'
    });
  });

  it('treats empty source after colon as omitted', () => {
    expect(parseScriptAskModelSpec('gpt-4o:')).toEqual({ model: 'gpt-4o' });
    expect(parseScriptAskModelSpec('gpt-4o:   ')).toEqual({ model: 'gpt-4o' });
  });

  it('throws when the model segment is empty', () => {
    expect(() => parseScriptAskModelSpec(': personal')).toThrow(
      'hc.ask model selection requires a model name before ":"'
    );
  });
});

describe('resolveScriptAskModel', () => {
  it('returns undefined when no AI models are available', () => {
    expect(resolveScriptAskModel('GPT-4o Mini', EMPTY_SETTINGS)).toBeUndefined();
    expect(resolveScriptAskModel(undefined, EMPTY_SETTINGS)).toBeUndefined();
  });

  it('returns the first available model when spec is omitted', () => {
    const option = resolveScriptAskModel(undefined, PERSONAL_SETTINGS, HUB_GROUPS);
    // Hub models are listed before personal in getAvailableModels.
    expect(option?.id).toBe('gpt-4o');
    expect(option?.source).toBe('hub');
  });

  it('matches model-only by id across sources (first match wins)', () => {
    const option = resolveScriptAskModel('gpt-4o', PERSONAL_SETTINGS, HUB_GROUPS);
    expect(option).toMatchObject({
      id: 'gpt-4o',
      source: 'hub',
      hubId: 'hub-1'
    });
  });

  it('matches personal models by label and source case-insensitively', () => {
    const option = resolveScriptAskModel('gpt-4o mini: personal', PERSONAL_SETTINGS);
    expect(option).toMatchObject({
      id: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      source: 'personal'
    });
  });

  it('matches personal models by provider id with source', () => {
    const option = resolveScriptAskModel('gpt-4o-mini: Personal', PERSONAL_SETTINGS);
    expect(option?.id).toBe('gpt-4o-mini');
    expect(option?.source).toBe('personal');
  });

  it('matches hub models by hub display name source', () => {
    const option = resolveScriptAskModel('GPT-4o: Sean (Team Hub)', EMPTY_SETTINGS, HUB_GROUPS);
    expect(option).toMatchObject({
      id: 'gpt-4o',
      source: 'hub',
      hubId: 'hub-1',
      hubName: 'Sean (Team Hub)'
    });
  });

  it('selects the personal entry when source is Personal for a shared id', () => {
    const option = resolveScriptAskModel('GPT-4o: Personal', PERSONAL_SETTINGS, HUB_GROUPS);
    expect(option?.source).toBe('personal');
    expect(option?.value).toBe('personal:gpt-4o');
  });

  it('returns undefined for unknown source or model', () => {
    expect(
      resolveScriptAskModel('GPT-4o Mini: Missing Hub', PERSONAL_SETTINGS, HUB_GROUPS)
    ).toBeUndefined();
    expect(resolveScriptAskModel('not-a-model: Personal', PERSONAL_SETTINGS)).toBeUndefined();
    expect(resolveScriptAskModel('not-a-model', PERSONAL_SETTINGS)).toBeUndefined();
  });
});
