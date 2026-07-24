import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { parseJson } from '#/shared/parseJson';

const GITHUB_MODELS_AUTH_KEY = 'githubModelsAuth';

/**
 * Encrypted GitHub Models OAuth payload stored locally.
 */
interface StoredGithubModelsAuth {
  /**
   * OAuth access token with models:read permission.
   */
  accessToken: EncryptedSecret;

  /**
   * OAuth refresh token when GitHub returns one.
   */
  refreshToken?: EncryptedSecret;

  /**
   * OAuth access token expiry as ISO 8601 timestamp.
   */
  expiresAt?: string;

  /**
   * GitHub login for the authorized user, when known.
   */
  login?: string;
}

/**
 * Reads stored GitHub Models auth from the local registry.
 */
function readGithubModelsAuth(): StoredGithubModelsAuth | undefined {
  const raw = getLocalDatabase().getSetting(GITHUB_MODELS_AUTH_KEY);
  if (!raw) {
    return undefined;
  }
  return parseJson<StoredGithubModelsAuth | undefined>(raw, undefined);
}

/**
 * Persists GitHub Models auth to the local registry.
 *
 * @param auth - Encrypted auth payload to store.
 */
function writeGithubModelsAuth(auth: StoredGithubModelsAuth | undefined): void {
  if (!auth) {
    getLocalDatabase().setSetting(GITHUB_MODELS_AUTH_KEY, '');
    return;
  }
  getLocalDatabase().setSetting(GITHUB_MODELS_AUTH_KEY, JSON.stringify(auth));
}

/**
 * Stores encrypted GitHub Models OAuth tokens and optional login metadata.
 *
 * @param accessToken - OAuth access token.
 * @param refreshToken - Optional refresh token.
 * @param expiresAt - Optional ISO expiry for the access token.
 * @param login - Optional GitHub login for display.
 */
export function storeGithubModelsTokens(
  accessToken: string,
  refreshToken?: string,
  expiresAt?: string,
  login?: string
): void {
  const auth: StoredGithubModelsAuth = {
    accessToken: encryptSecret(accessToken),
    refreshToken: refreshToken ? encryptSecret(refreshToken) : undefined,
    expiresAt,
    login: login?.trim() || undefined
  };
  writeGithubModelsAuth(auth);
}

/**
 * Returns the decrypted GitHub Models access token, if stored.
 */
export function getGithubModelsAccessToken(): string | undefined {
  const auth = readGithubModelsAuth();
  if (!auth) {
    return undefined;
  }
  try {
    return decryptSecret(auth.accessToken);
  } catch {
    return undefined;
  }
}

/**
 * Returns the decrypted GitHub Models refresh token, if stored.
 */
export function getGithubModelsRefreshToken(): string | undefined {
  const auth = readGithubModelsAuth();
  if (!auth?.refreshToken) {
    return undefined;
  }
  try {
    return decryptSecret(auth.refreshToken);
  } catch {
    return undefined;
  }
}

/**
 * Returns the stored GitHub Models access token expiry.
 */
export function getGithubModelsTokenExpiresAt(): string | undefined {
  return readGithubModelsAuth()?.expiresAt;
}

/**
 * Returns the stored GitHub login for the authorized user.
 */
export function getGithubModelsLogin(): string | undefined {
  return readGithubModelsAuth()?.login;
}

/**
 * Returns whether a GitHub Models access token is stored.
 */
export function hasGithubModelsAccessToken(): boolean {
  return getGithubModelsAccessToken() != null;
}

/**
 * Removes stored GitHub Models auth.
 */
export function deleteGithubModelsAuth(): void {
  writeGithubModelsAuth(undefined);
}
