import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { parseJson } from '#/shared/parseJson';

const OAUTH_SECRETS_KEY = 'oauthTokens';

/**
 * Encrypted OAuth token payload stored for a cache key.
 */
interface StoredOAuthSecret {
  /**
   * OAuth access token.
   */
  accessToken: EncryptedSecret;

  /**
   * ISO 8601 expiry timestamp when known.
   */
  expiresAt?: string;

  /**
   * Token type from the token response, typically Bearer.
   */
  tokenType: string;
}

/**
 * Reads all stored OAuth tokens from the local registry.
 */
function readAllOAuthSecrets(): Record<string, StoredOAuthSecret> {
  return parseJson<Record<string, StoredOAuthSecret>>(
    getLocalDatabase().getSetting(OAUTH_SECRETS_KEY),
    {}
  );
}

/**
 * Persists all OAuth tokens to the local registry.
 *
 * @param secrets - Map keyed by OAuth cache key.
 */
function writeAllOAuthSecrets(secrets: Record<string, StoredOAuthSecret>): void {
  getLocalDatabase().setSetting(OAUTH_SECRETS_KEY, JSON.stringify(secrets));
}

/**
 * Stores an encrypted OAuth access token for a cache key.
 *
 * @param cacheKey - Stable cache key such as request:1 or collection:2.
 * @param accessToken - OAuth access token plaintext.
 * @param tokenType - Token type from the authorization server.
 * @param expiresAt - Optional ISO expiry for the access token.
 */
export function storeOAuthToken(
  cacheKey: string,
  accessToken: string,
  tokenType: string,
  expiresAt?: string
): void {
  const all = readAllOAuthSecrets();
  all[cacheKey] = {
    accessToken: encryptSecret(accessToken),
    tokenType,
    expiresAt
  };
  writeAllOAuthSecrets(all);
}

/**
 * Returns the decrypted OAuth token payload for a cache key, if stored.
 *
 * @param cacheKey - Stable cache key such as request:1 or collection:2.
 */
export function getOAuthToken(cacheKey: string):
  | {
      accessToken: string;
      expiresAt?: string;
      tokenType: string;
    }
  | undefined {
  const entry = readAllOAuthSecrets()[cacheKey];
  if (!entry) {
    return undefined;
  }

  try {
    return {
      accessToken: decryptSecret(entry.accessToken),
      expiresAt: entry.expiresAt,
      tokenType: entry.tokenType
    };
  } catch {
    return undefined;
  }
}

/**
 * Removes stored OAuth tokens for a cache key.
 *
 * @param cacheKey - Stable cache key such as request:1 or collection:2.
 */
export function deleteOAuthToken(cacheKey: string): void {
  const all = readAllOAuthSecrets();
  if (!all[cacheKey]) {
    return;
  }
  delete all[cacheKey];
  writeAllOAuthSecrets(all);
}
