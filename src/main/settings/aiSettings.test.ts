import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import {
  clearSecretEncryptorForTesting,
  type EncryptedSecret,
  type SecretEncryptor,
  setSecretEncryptorForTesting
} from '#/main/secrets/secretStorage';
import { DEFAULT_AI_SETTINGS, getAiSettings, setAiSettings } from '#/main/settings/aiSettings';

describe('aiSettings', () => {
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
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
    clearSecretEncryptorForTesting();
  });

  it('returns defaults when unset', () => {
    expect(getAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('trims whitespace on read and write', () => {
    setAiSettings({
      openaiApiKey: ' sk-openai ',
      claudeApiKey: ' sk-claude ',
      geminiApiKey: ' sk-gemini '
    });

    expect(getAiSettings()).toEqual({
      openaiApiKey: 'sk-openai',
      claudeApiKey: 'sk-claude',
      geminiApiKey: 'sk-gemini'
    });
  });

  it('round-trips saved values', () => {
    const settings = {
      openaiApiKey: 'sk-openai-test',
      claudeApiKey: 'sk-claude-test',
      geminiApiKey: 'sk-gemini-test'
    };

    setAiSettings(settings);

    expect(getAiSettings()).toEqual(settings);
  });

  it('stores encrypted values rather than plaintext keys', () => {
    setAiSettings({
      openaiApiKey: 'sk-openai-test',
      claudeApiKey: 'sk-claude-test',
      geminiApiKey: 'sk-gemini-test'
    });

    const stored = settingsStore.aiSettings ?? '';
    expect(stored).not.toContain('sk-openai-test');
    expect(stored).not.toContain('sk-claude-test');
    expect(stored).not.toContain('sk-gemini-test');
    expect(stored).toContain('"method":"safeStorage"');
  });

  it('migrates legacy plaintext settings to encrypted storage', () => {
    settingsStore.aiSettings = JSON.stringify({
      openaiApiKey: 'legacy-openai',
      claudeApiKey: 'legacy-claude',
      geminiApiKey: 'legacy-gemini'
    });

    expect(getAiSettings()).toEqual({
      openaiApiKey: 'legacy-openai',
      claudeApiKey: 'legacy-claude',
      geminiApiKey: 'legacy-gemini'
    });

    const stored = settingsStore.aiSettings ?? '';
    expect(stored).not.toContain('legacy-openai');
    expect(stored).toContain('"method":"safeStorage"');
  });
});
