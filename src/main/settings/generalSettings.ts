import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { parseJson } from '#/shared/parseJson';
import {
  DEFAULT_CODE_EDITOR_SETUP,
  normalizeCodeEditorSetup,
  normalizeCodeEditorTheme
} from '#/shared/codeEditorSettings';
import type { GeneralSettings, ProxyProtocol, ProxySettings } from '#/shared/types';

/**
 * Absolute ceiling for the configurable max response size setting (MB).
 */
export const HARD_MAX_RESPONSE_SIZE_MB = 512;

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  protocol: 'http',
  host: '',
  port: 8080,
  authEnabled: false,
  username: '',
  password: ''
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  requestTimeoutMs: 30000,
  maxResponseSizeMb: 50,
  verifySsl: true,
  codeEditorTheme: 'default',
  codeEditorSetup: { ...DEFAULT_CODE_EDITOR_SETUP },
  proxy: { ...DEFAULT_PROXY_SETTINGS }
};

const STORE_KEY = 'general';

/**
 * Normalizes a non-negative number, falling back to the default when invalid.
 *
 * @param value - Raw numeric value from storage or input.
 * @param fallback - Default when value is not a finite number >= 0.
 */
function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalizes a positive integer port, falling back to the default when invalid.
 *
 * @param value - Raw port from storage or input.
 * @param fallback - Default when value is not a finite integer in 1–65535.
 */
function normalizePort(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalizes proxy protocol to http or https.
 *
 * @param value - Raw protocol from storage or input.
 */
function normalizeProxyProtocol(value: unknown): ProxyProtocol {
  return value === 'https' ? 'https' : 'http';
}

/**
 * Normalizes proxy settings with defaults for invalid fields.
 *
 * @param input - Raw proxy settings from storage or user input.
 * @returns Normalized proxy settings.
 */
function normalizeProxySettings(input: Partial<ProxySettings> | undefined): ProxySettings {
  return {
    enabled: input?.enabled === true,
    protocol: normalizeProxyProtocol(input?.protocol),
    host: typeof input?.host === 'string' ? input.host.trim() : DEFAULT_PROXY_SETTINGS.host,
    port: normalizePort(input?.port, DEFAULT_PROXY_SETTINGS.port),
    authEnabled: input?.authEnabled === true,
    username:
      typeof input?.username === 'string' ? input.username : DEFAULT_PROXY_SETTINGS.username,
    password: typeof input?.password === 'string' ? input.password : DEFAULT_PROXY_SETTINGS.password
  };
}

/**
 * Normalizes a general settings object with defaults for invalid fields.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizeSettings(input: Partial<GeneralSettings>): GeneralSettings {
  return {
    requestTimeoutMs: normalizeNonNegativeNumber(
      input.requestTimeoutMs,
      DEFAULT_GENERAL_SETTINGS.requestTimeoutMs
    ),
    maxResponseSizeMb: Math.min(
      normalizeNonNegativeNumber(
        input.maxResponseSizeMb,
        DEFAULT_GENERAL_SETTINGS.maxResponseSizeMb
      ),
      HARD_MAX_RESPONSE_SIZE_MB
    ),
    verifySsl: input.verifySsl !== false,
    codeEditorTheme: normalizeCodeEditorTheme(input.codeEditorTheme),
    codeEditorSetup: normalizeCodeEditorSetup(input.codeEditorSetup),
    proxy: normalizeProxySettings(input.proxy)
  };
}

/**
 * Reads persisted general request settings.
 *
 * @returns Current general settings with defaults applied.
 */
export function getGeneralSettings(): GeneralSettings {
  const stored = parseJson<Partial<GeneralSettings>>(
    getLocalDatabase().getSetting(STORE_KEY),
    DEFAULT_GENERAL_SETTINGS
  );
  return normalizeSettings(stored);
}

/**
 * Persists general request settings.
 *
 * @param input - Settings to store.
 */
export function setGeneralSettings(input: GeneralSettings): void {
  getLocalDatabase().setSetting(STORE_KEY, JSON.stringify(normalizeSettings(input)));
}
