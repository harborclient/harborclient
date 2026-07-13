import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { parseJson } from '#/shared/parseJson';
import type { GitAuthMethod, GitIdentity } from '#/shared/types';
import { hasGitAccessToken } from '#/main/git/gitSecrets';

const GIT_IDENTITIES_KEY = 'gitHostIdentities';

/**
 * Persisted git identity metadata without runtime credential flags.
 */
interface StoredGitIdentityRecord {
  /**
   * Normalized lowercase hostname.
   */
  host: string;

  /**
   * Auth method metadata for the host.
   */
  auth: GitAuthMethod;

  /**
   * Optional GitHub OAuth App client id override.
   */
  oauthClientId?: string;
}

/**
 * Persisted git identity metadata keyed by normalized hostname.
 */
interface StoredGitIdentities {
  /**
   * Map of lowercase host keys to identity records.
   */
  identities: Record<string, StoredGitIdentityRecord>;
}

/**
 * Reads all stored git host identities from the local registry.
 */
function readStoredIdentities(): StoredGitIdentities {
  return parseJson<StoredGitIdentities>(getLocalDatabase().getSetting(GIT_IDENTITIES_KEY), {
    identities: {}
  });
}

/**
 * Persists all git host identities to the local registry.
 *
 * @param data - Identity map to store.
 */
function writeStoredIdentities(data: StoredGitIdentities): void {
  getLocalDatabase().setSetting(GIT_IDENTITIES_KEY, JSON.stringify(data));
}

/**
 * Returns all saved git host identities.
 */
export function listGitIdentities(): GitIdentity[] {
  const { identities } = readStoredIdentities();
  return Object.values(identities)
    .map((identity) => ({
      ...identity,
      hasCredentials: hasGitAccessToken(identity.host)
    }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Returns the identity for a host key when present.
 *
 * @param host - Normalized lowercase hostname.
 */
export function getGitIdentity(host: string): GitIdentity | undefined {
  return readStoredIdentities().identities[host];
}

/**
 * Returns whether a stored identity has credential metadata for the host.
 *
 * @param host - Normalized lowercase hostname.
 */
export function hasGitIdentity(host: string): boolean {
  return getGitIdentity(host) != null;
}

/**
 * Creates or updates git identity metadata for a host.
 *
 * @param host - Normalized lowercase hostname.
 * @param patch - Identity fields to merge.
 */
export function upsertGitIdentity(
  host: string,
  patch: Partial<Omit<GitIdentity, 'host'>> & Pick<GitIdentity, 'auth'>
): GitIdentity {
  const stored = readStoredIdentities();
  const existing = stored.identities[host];
  const storedRecord: StoredGitIdentityRecord = {
    host,
    auth: patch.auth,
    oauthClientId: patch.oauthClientId ?? existing?.oauthClientId
  };
  if (storedRecord.oauthClientId === undefined) {
    delete storedRecord.oauthClientId;
  }
  stored.identities[host] = storedRecord;
  writeStoredIdentities(stored);
  return storedRecord;
}

/**
 * Updates only the auth metadata for a host identity.
 *
 * @param host - Normalized lowercase hostname.
 * @param auth - Auth method metadata.
 */
export function persistGitIdentityAuth(host: string, auth: GitAuthMethod): GitIdentity {
  const existing = getGitIdentity(host);
  return upsertGitIdentity(host, {
    auth,
    oauthClientId: existing?.oauthClientId
  });
}

/**
 * Updates the optional GitHub OAuth client id override for a host identity.
 *
 * @param host - Normalized lowercase hostname.
 * @param oauthClientId - OAuth App client id, or empty to clear.
 */
export function setGitIdentityOAuthClientId(host: string, oauthClientId: string): GitIdentity {
  const existing = getGitIdentity(host);
  const auth: GitAuthMethod = existing?.auth ?? { kind: 'pat', username: 'token' };
  const trimmed = oauthClientId.trim();
  return upsertGitIdentity(host, {
    auth,
    oauthClientId: trimmed || undefined
  });
}

/**
 * Removes identity metadata for a host.
 *
 * @param host - Normalized lowercase hostname.
 */
export function deleteGitIdentity(host: string): void {
  const stored = readStoredIdentities();
  if (!stored.identities[host]) {
    return;
  }
  delete stored.identities[host];
  writeStoredIdentities(stored);
}
