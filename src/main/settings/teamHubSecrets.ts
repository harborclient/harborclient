import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { parseJson } from '#/shared/parseJson';

const TEAM_HUB_SECRETS_KEY = 'teamHubSecrets';

/**
 * Reads all encrypted Team Hub bearer tokens keyed by hub connection id.
 */
function readAllTeamHubSecrets(): Record<string, EncryptedSecret> {
  return parseJson<Record<string, EncryptedSecret>>(
    getLocalDatabase().getSetting(TEAM_HUB_SECRETS_KEY),
    {}
  );
}

/**
 * Persists encrypted Team Hub bearer tokens to the local registry.
 *
 * @param secrets - Map keyed by team hub connection id.
 */
function writeAllTeamHubSecrets(secrets: Record<string, EncryptedSecret>): void {
  getLocalDatabase().setSetting(TEAM_HUB_SECRETS_KEY, JSON.stringify(secrets));
}

/**
 * Stores an encrypted bearer token for a team hub connection.
 *
 * @param hubId - Team hub connection id.
 * @param token - Plaintext API bearer token secret.
 */
export function storeTeamHubToken(hubId: string, token: string): void {
  const all = readAllTeamHubSecrets();
  all[hubId] = encryptSecret(token);
  writeAllTeamHubSecrets(all);
}

/**
 * Returns the decrypted bearer token for a team hub connection, if stored.
 *
 * @param hubId - Team hub connection id.
 */
export function getTeamHubToken(hubId: string): string | undefined {
  const entry = readAllTeamHubSecrets()[hubId];
  if (!entry) {
    return undefined;
  }
  try {
    return decryptSecret(entry);
  } catch {
    return undefined;
  }
}

/**
 * Removes the stored bearer token for a team hub connection.
 *
 * @param hubId - Team hub connection id.
 */
export function deleteTeamHubToken(hubId: string): void {
  const all = readAllTeamHubSecrets();
  if (!all[hubId]) {
    return;
  }
  delete all[hubId];
  writeAllTeamHubSecrets(all);
}

/**
 * Returns hub ids that currently have encrypted bearer tokens in the sidecar store.
 */
export function listTeamHubSecretIds(): string[] {
  return Object.keys(readAllTeamHubSecrets());
}
