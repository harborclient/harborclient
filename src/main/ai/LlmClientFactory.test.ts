import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OpenAI from 'openai';
import type { LocalRegistry } from '#/main/db/LocalRegistry';
import {
  clearLocalRegistryForTesting,
  setLocalRegistryForTesting
} from '#/main/db/localRegistryInstance';
import { LlmClientFactory } from '#/main/ai/LlmClientFactory';
import {
  clearSecretEncryptorForTesting,
  type EncryptedSecret,
  type SecretEncryptor,
  setSecretEncryptorForTesting
} from '#/main/secrets/secretStorage';
import { setAiSettings } from '#/main/settings/aiSettings';

describe('LlmClientFactory', () => {
  let settingsStore: Record<string, string>;

  const mockEncryptor: SecretEncryptor = {
    isOsEncryptionAvailable: () => true,
    encrypt: (plaintext) => ({
      v: 1,
      method: 'safeStorage',
      ciphertext: Buffer.from(`mock:${plaintext}`, 'utf8').toString('base64')
    }),
    decrypt: (payload: EncryptedSecret) => {
      const decoded = Buffer.from(payload.ciphertext, 'base64').toString('utf8');
      if (!decoded.startsWith('mock:')) {
        throw new Error('Invalid mock ciphertext.');
      }
      return decoded.slice('mock:'.length);
    }
  };

  beforeEach(() => {
    settingsStore = {};
    const registry = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalRegistry;
    setLocalRegistryForTesting(registry);
    setSecretEncryptorForTesting(mockEncryptor);
    setAiSettings({
      openaiApiKey: 'sk-openai-test',
      claudeApiKey: 'sk-claude-test',
      geminiApiKey: 'sk-gemini-test'
    });
  });

  afterEach(() => {
    clearLocalRegistryForTesting();
    clearSecretEncryptorForTesting();
  });

  it('returns an OpenAI client for the requested provider', () => {
    const factory = new LlmClientFactory();

    expect(factory.factory('openai')).toBeInstanceOf(OpenAI);
    expect(factory.factory('claude')).toBeInstanceOf(OpenAI);
    expect(factory.factory('gemini')).toBeInstanceOf(OpenAI);
  });

  it('throws when the selected provider key is not configured', () => {
    setAiSettings({
      openaiApiKey: '',
      claudeApiKey: 'sk-claude-test',
      geminiApiKey: 'sk-gemini-test'
    });

    expect(() => new LlmClientFactory().factory('openai')).toThrow(
      /OpenAI API key is not configured/
    );
  });
});
