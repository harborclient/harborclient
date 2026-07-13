import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { parseJson } from '#/shared/parseJson';
import { normalizeGitHostKey } from '#/shared/gitUrl';
import { listStorageConnections } from '#/main/settings/storageSettings';
import {
  getGitIdentity,
  persistGitIdentityAuth,
  upsertGitIdentity
} from '#/main/git/gitIdentities';

const GIT_SECRETS_KEY = 'gitConnectionSecrets';
const GIT_SECRETS_MIGRATED_KEY = 'gitHostSecretsMigrated';

/**
 * Encrypted credential payload stored for a git host.
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
 * Reads all stored git host secrets from the local registry.
 */
function readAllGitSecrets(): Record<string, StoredGitSecret> {
  return parseJson<Record<string, StoredGitSecret>>(
    getLocalDatabase().getSetting(GIT_SECRETS_KEY),
    {}
  );
}

/**
 * Persists all git host secrets to the local registry.
 *
 * @param secrets - Map keyed by normalized host.
 */
function writeAllGitSecrets(secrets: Record<string, StoredGitSecret>): void {
  getLocalDatabase().setSetting(GIT_SECRETS_KEY, JSON.stringify(secrets));
}

/**
 * Promotes legacy per-connection secrets to per-host storage on first access.
 */
function migrateConnectionSecretsToHosts(): void {
  const db = getLocalDatabase();
  if (db.getSetting(GIT_SECRETS_MIGRATED_KEY) === '1') {
    return;
  }

  const all = readAllGitSecrets();
  const connections = listStorageConnections().filter((conn) => conn.type === 'git');
  let changed = false;

  for (const conn of connections) {
    if (conn.type !== 'git') {
      continue;
    }
    const legacySecret = all[conn.id];
    if (!legacySecret) {
      continue;
    }

    const host = normalizeGitHostKey(conn.settings.url);
    if (!host) {
      continue;
    }

    if (!all[host]) {
      all[host] = legacySecret;
      changed = true;
    }

    if (!getGitIdentity(host)) {
      upsertGitIdentity(host, {
        auth: conn.settings.auth,
        oauthClientId: conn.settings.oauthClientId
      });
    } else if (conn.settings.oauthClientId) {
      upsertGitIdentity(host, {
        auth: conn.settings.auth,
        oauthClientId: conn.settings.oauthClientId
      });
    } else {
      persistGitIdentityAuth(host, conn.settings.auth);
    }

    delete all[conn.id];
    changed = true;
  }

  if (changed) {
    writeAllGitSecrets(all);
  }

  db.setSetting(GIT_SECRETS_MIGRATED_KEY, '1');
}

/**
 * Ensures legacy secrets are migrated before host-keyed reads and writes.
 */
function ensureHostSecretsMigrated(): void {
  migrateConnectionSecretsToHosts();
}

/**
 * Stores an encrypted PAT for a git host.
 *
 * @param host - Normalized lowercase hostname.
 * @param token - Personal access token plaintext.
 */
export function storeGitPat(host: string, token: string): void {
  ensureHostSecretsMigrated();
  const all = readAllGitSecrets();
  all[host] = { accessToken: encryptSecret(token) };
  writeAllGitSecrets(all);
}

/**
 * Stores encrypted OAuth tokens for a git host.
 *
 * @param host - Normalized lowercase hostname.
 * @param accessToken - OAuth access token.
 * @param refreshToken - Optional refresh token.
 * @param expiresAt - Optional ISO expiry for the access token.
 */
export function storeGitOAuthTokens(
  host: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: string
): void {
  ensureHostSecretsMigrated();
  const all = readAllGitSecrets();
  all[host] = {
    accessToken: encryptSecret(accessToken),
    refreshToken: refreshToken ? encryptSecret(refreshToken) : undefined,
    expiresAt
  };
  writeAllGitSecrets(all);
}

/**
 * Returns the decrypted access token for a git host, if stored.
 *
 * @param host - Normalized lowercase hostname.
 */
export function getGitAccessToken(host: string): string | undefined {
  ensureHostSecretsMigrated();
  const entry = readAllGitSecrets()[host];
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
 * Returns the decrypted OAuth refresh token for a git host, if stored.
 *
 * @param host - Normalized lowercase hostname.
 */
export function getGitRefreshToken(host: string): string | undefined {
  ensureHostSecretsMigrated();
  const entry = readAllGitSecrets()[host];
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
 * Returns the stored OAuth access token expiry for a git host.
 *
 * @param host - Normalized lowercase hostname.
 */
export function getGitTokenExpiresAt(host: string): string | undefined {
  ensureHostSecretsMigrated();
  return readAllGitSecrets()[host]?.expiresAt;
}

/**
 * Returns whether an access token is stored for a git host.
 *
 * @param host - Normalized lowercase hostname.
 */
export function hasGitAccessToken(host: string): boolean {
  return getGitAccessToken(host) != null;
}

/**
 * Removes stored secrets for a git host.
 *
 * @param host - Normalized lowercase hostname.
 */
export function deleteGitSecrets(host: string): void {
  ensureHostSecretsMigrated();
  const all = readAllGitSecrets();
  if (!all[host]) {
    return;
  }
  delete all[host];
  writeAllGitSecrets(all);
}
