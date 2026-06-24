import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { parseJson } from '#/shared/parseJson';

const GIT_SECRETS_KEY = 'gitConnectionSecrets';

/**
 * Encrypted credential payload stored for a git connection.
 */
interface StoredGitSecret {
  /**
   * Personal access token or OAuth access token.
   */
  accessToken: EncryptedSecret;

  /**
   * OAuth refresh token when applicable.
   */
  refreshToken?: EncryptedSecret;

  /**
   * OAuth access token expiry as ISO 8601 timestamp.
   */
  expiresAt?: string;
}

/**
 * Reads all stored git connection secrets from the local registry.
 */
function readAllGitSecrets(): Record<string, StoredGitSecret> {
  return parseJson<Record<string, StoredGitSecret>>(
    getLocalDatabase().getSetting(GIT_SECRETS_KEY),
    {}
  );
}

/**
 * Persists all git connection secrets to the local registry.
 *
 * @param secrets - Map keyed by connection id.
 */
function writeAllGitSecrets(secrets: Record<string, StoredGitSecret>): void {
  getLocalDatabase().setSetting(GIT_SECRETS_KEY, JSON.stringify(secrets));
}

/**
 * Stores an encrypted PAT for a git connection.
 *
 * @param connectionId - Git connection id.
 * @param token - Personal access token plaintext.
 */
export function storeGitPat(connectionId: string, token: string): void {
  const all = readAllGitSecrets();
  all[connectionId] = { accessToken: encryptSecret(token) };
  writeAllGitSecrets(all);
}

/**
 * Stores encrypted OAuth tokens for a git connection.
 *
 * @param connectionId - Git connection id.
 * @param accessToken - OAuth access token.
 * @param refreshToken - Optional refresh token.
 * @param expiresAt - Optional ISO expiry for the access token.
 */
export function storeGitOAuthTokens(
  connectionId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: string
): void {
  const all = readAllGitSecrets();
  all[connectionId] = {
    accessToken: encryptSecret(accessToken),
    refreshToken: refreshToken ? encryptSecret(refreshToken) : undefined,
    expiresAt
  };
  writeAllGitSecrets(all);
}

/**
 * Returns the decrypted access token for a git connection, if stored.
 *
 * @param connectionId - Git connection id.
 */
export function getGitAccessToken(connectionId: string): string | undefined {
  const entry = readAllGitSecrets()[connectionId];
  if (!entry) {
    return undefined;
  }
  try {
    return decryptSecret(entry.accessToken);
  } catch {
    return undefined;
  }
}

/**
 * Returns the decrypted OAuth refresh token for a git connection, if stored.
 *
 * @param connectionId - Git connection id.
 */
export function getGitRefreshToken(connectionId: string): string | undefined {
  const entry = readAllGitSecrets()[connectionId];
  if (!entry?.refreshToken) {
    return undefined;
  }
  try {
    return decryptSecret(entry.refreshToken);
  } catch {
    return undefined;
  }
}

/**
 * Returns the stored OAuth access token expiry for a git connection.
 *
 * @param connectionId - Git connection id.
 */
export function getGitTokenExpiresAt(connectionId: string): string | undefined {
  return readAllGitSecrets()[connectionId]?.expiresAt;
}

/**
 * Removes stored secrets for a git connection.
 *
 * @param connectionId - Git connection id.
 */
export function deleteGitSecrets(connectionId: string): void {
  const all = readAllGitSecrets();
  if (!all[connectionId]) {
    return;
  }
  delete all[connectionId];
  writeAllGitSecrets(all);
}
