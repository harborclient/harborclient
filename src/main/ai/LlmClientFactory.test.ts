import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OpenAI from 'openai';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { LlmClientFactory } from './LlmClientFactory';
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
    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalDatabase;
    setLocalDatabaseForTesting(database);
    setSecretEncryptorForTesting(mockEncryptor);
    setAiSettings({
      openaiApiKey: 'sk-openai-test',
      claudeApiKey: 'sk-claude-test',
      geminiApiKey: 'sk-gemini-test'
    });
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
    clearSecretEncryptorForTesting();
  });

  it('returns an OpenAI client for the requested provider', async () => {
    const factory = new LlmClientFactory();

    await expect(factory.factory('openai')).resolves.toBeInstanceOf(OpenAI);
    await expect(factory.factory('claude')).resolves.toBeInstanceOf(OpenAI);
    await expect(factory.factory('gemini')).resolves.toBeInstanceOf(OpenAI);
  });

  it('throws when the selected provider key is not configured', async () => {
    setAiSettings({
      openaiApiKey: '',
      claudeApiKey: 'sk-claude-test',
      geminiApiKey: 'sk-gemini-test'
    });

    await expect(new LlmClientFactory().factory('openai')).rejects.toThrow(
      /OpenAI API key is not configured/
    );
  });
});
