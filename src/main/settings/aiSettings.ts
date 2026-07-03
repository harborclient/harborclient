import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { parseJson } from '#/shared/parseJson';
import type { AiSettings } from '#/shared/types';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  openaiApiKey: '',
  claudeApiKey: '',
  geminiApiKey: ''
};

const STORE_KEY = 'aiSettings';

/**
 * Normalizes AI settings from storage or user input.
 *
 * @param input - Partial or raw AI settings.
 * @returns Sanitized AI settings with trimmed key fields.
 */
function normalizeSettings(input: Partial<AiSettings>): AiSettings {
  return {
    openaiApiKey: String(input.openaiApiKey ?? '').trim(),
    claudeApiKey: String(input.claudeApiKey ?? '').trim(),
    geminiApiKey: String(input.geminiApiKey ?? '').trim()
  };
}

/**
 * Returns true when the parsed value looks like legacy plaintext AI settings.
 *
 * @param value - Parsed registry value.
 */
function isLegacyPlaintextAiSettings(value: unknown): value is Partial<AiSettings> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return 'openaiApiKey' in value || 'claudeApiKey' in value || 'geminiApiKey' in value;
}

/**
 * Returns true when the parsed value is an encrypted secret envelope.
 *
 * @param value - Parsed registry value.
 */
function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as EncryptedSecret;
  return (
    record.v === 1 &&
    (record.method === 'safeStorage' || record.method === 'local') &&
    typeof record.ciphertext === 'string'
  );
}

/**
 * Reads persisted AI provider API keys.
 *
 * @returns Current AI settings with defaults applied.
 */
export function getAiSettings(): AiSettings {
  const raw = getLocalDatabase().getSetting(STORE_KEY);
  if (!raw) {
    return DEFAULT_AI_SETTINGS;
  }

  const parsed: unknown = parseJson(raw, null);
  if (!parsed) {
    return DEFAULT_AI_SETTINGS;
  }

  if (isLegacyPlaintextAiSettings(parsed)) {
    const normalized = normalizeSettings(parsed);
    setAiSettings(normalized);
    return normalized;
  }

  if (isEncryptedSecret(parsed)) {
    try {
      const decrypted = decryptSecret(parsed);
      const settings = parseJson<Partial<AiSettings>>(decrypted, DEFAULT_AI_SETTINGS);
      return normalizeSettings(settings);
    } catch {
      // OS keychain encryption may be unavailable (for example in CI or automated
      // Electron launches). Treat unreadable secrets as unset rather than failing
      // settings bootstrap across every section.
      return DEFAULT_AI_SETTINGS;
    }
  }

  throw new Error('Stored AI settings are invalid or corrupted.');
}

/**
 * Persists AI provider API keys.
 *
 * @param input - Settings to store.
 */
export function setAiSettings(input: AiSettings): void {
  const normalized = normalizeSettings(input);
  const encrypted = encryptSecret(JSON.stringify(normalized));
  getLocalDatabase().setSetting(STORE_KEY, JSON.stringify(encrypted));
}
