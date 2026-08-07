import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { isPlainObject, parseJson } from '@harborclient/core/parseJson';
import type { LocalMlsGroupState } from './teamHubDiscussionMls';

const TEAM_HUB_MLS_GROUP_STATE_SETTING = 'teamHubMlsGroupState';

/**
 * Reads all encrypted MLS group state bundles keyed by hub and group ids.
 */
function readAllMlsGroupStateBundles(): Record<string, EncryptedSecret> {
  const parsed = parseJson(getLocalDatabase().getSetting(TEAM_HUB_MLS_GROUP_STATE_SETTING), {});
  if (!isPlainObject(parsed)) {
    return {};
  }
  return parsed as Record<string, EncryptedSecret>;
}

/**
 * Persists encrypted MLS group state bundles to the local registry.
 *
 * @param bundles - Map keyed by hub/group storage keys.
 */
function writeAllMlsGroupStateBundles(bundles: Record<string, EncryptedSecret>): void {
  getLocalDatabase().setSetting(TEAM_HUB_MLS_GROUP_STATE_SETTING, JSON.stringify(bundles));
}

/**
 * Builds the storage key for one hub connection and MLS group id pair.
 *
 * @param hubId - Team Hub connection id.
 * @param mlsGroupId - Canonical MLS group id for the discussion thread.
 */
export function buildMlsGroupStateStorageKey(hubId: string, mlsGroupId: string): string {
  return `${hubId}::${mlsGroupId}`;
}

/**
 * Returns decrypted MLS group state for one hub thread, if present.
 *
 * @param hubId - Team Hub connection id.
 * @param mlsGroupId - Canonical MLS group id for the discussion thread.
 */
export function getStoredMlsGroupState(
  hubId: string,
  mlsGroupId: string
): LocalMlsGroupState | undefined {
  const entry = readAllMlsGroupStateBundles()[buildMlsGroupStateStorageKey(hubId, mlsGroupId)];
  if (!entry) {
    return undefined;
  }

  try {
    const parsed = parseJson(decryptSecret(entry), null);
    if (!isPlainObject(parsed)) {
      return undefined;
    }

    return parsed as unknown as LocalMlsGroupState;
  } catch {
    return undefined;
  }
}

/**
 * Stores encrypted MLS group state for one hub thread.
 *
 * @param hubId - Team Hub connection id.
 * @param state - Local MLS group state to encrypt and persist.
 */
export function storeMlsGroupState(hubId: string, state: LocalMlsGroupState): void {
  const all = readAllMlsGroupStateBundles();
  all[buildMlsGroupStateStorageKey(hubId, state.mlsGroupId)] = encryptSecret(JSON.stringify(state));
  writeAllMlsGroupStateBundles(all);
}

/**
 * Removes stored MLS group state for one hub thread.
 *
 * @param hubId - Team Hub connection id.
 * @param mlsGroupId - Canonical MLS group id for the discussion thread.
 */
export function deleteStoredMlsGroupState(hubId: string, mlsGroupId: string): void {
  const all = readAllMlsGroupStateBundles();
  const key = buildMlsGroupStateStorageKey(hubId, mlsGroupId);
  if (!all[key]) {
    return;
  }

  delete all[key];
  writeAllMlsGroupStateBundles(all);
}
