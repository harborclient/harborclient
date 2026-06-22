import { describe, expect, it } from 'vitest';
import { resolveLlmClientOptions } from '#/main/ai/llmClientOptions';
import type { AiSettings } from '#/shared/types';

const TEST_SETTINGS: AiSettings = {
  openaiApiKey: 'sk-openai-test',
  claudeApiKey: 'sk-claude-test',
  geminiApiKey: 'sk-gemini-test'
};

describe('resolveLlmClientOptions', () => {
  it('returns apiKey only for OpenAI', () => {
    expect(resolveLlmClientOptions('openai', TEST_SETTINGS)).toEqual({
      apiKey: 'sk-openai-test'
    });
  });

  it('returns Claude base URL and apiKey', () => {
    expect(resolveLlmClientOptions('claude', TEST_SETTINGS)).toEqual({
      apiKey: 'sk-claude-test',
      baseURL: 'https://api.anthropic.com/v1/'
    });
  });

  it('returns Gemini base URL and apiKey', () => {
    expect(resolveLlmClientOptions('gemini', TEST_SETTINGS)).toEqual({
      apiKey: 'sk-gemini-test',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    });
  });

  it('throws when OpenAI key is empty', () => {
    expect(() =>
      resolveLlmClientOptions('openai', { ...TEST_SETTINGS, openaiApiKey: '  ' })
    ).toThrow(/OpenAI API key is not configured/);
  });

  it('throws when Claude key is empty', () => {
    expect(() => resolveLlmClientOptions('claude', { ...TEST_SETTINGS, claudeApiKey: '' })).toThrow(
      /Claude API key is not configured/
    );
  });

  it('throws when Gemini key is empty', () => {
    expect(() => resolveLlmClientOptions('gemini', { ...TEST_SETTINGS, geminiApiKey: '' })).toThrow(
      /Google Gemini API key is not configured/
    );
  });
});
