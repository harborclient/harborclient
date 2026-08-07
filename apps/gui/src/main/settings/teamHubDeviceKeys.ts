import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { isPlainObject, parseJson } from '@harborclient/core/parseJson';

const TEAM_HUB_DEVICE_KEYS_SETTING = 'teamHubDeviceKeys';

/**
 * Metadata persisted alongside encrypted private key material for one hub device.
 */
export interface StoredTeamHubDeviceIdentity {
  /**
   * Team Hub connection id this identity belongs to.
   */
  hubId: string;

  /**
   * Authenticated user id at enrollment time.
   */
  userId: string;

  /**
   * Client-generated stable device identifier.
   */
  deviceId: string;

  /**
   * Server-side device key record id returned by enrollment.
   */
  serverDeviceKeyId: string;

  /**
   * Human-readable label shown in admin listings.
   */
  label: string;

  /**
   * sha256 fingerprint of the uploaded public key material.
   */
  fingerprint: string;

  /**
   * ISO timestamp when enrollment completed locally.
   */
  enrolledAt: string;
}

/**
 * Encrypted bundle stored per hub connection id.
 */
interface StoredTeamHubDeviceBundle {
  /**
   * Public enrollment metadata for quick status checks.
   */
  identity: StoredTeamHubDeviceIdentity;

  /**
   * Base64 PKCS8 private key material; never uploaded to Team Hub.
   */
  privateKeyMaterial: string;
}

/**
 * Reads all encrypted Team Hub device bundles keyed by hub connection id.
 */
function readAllTeamHubDeviceBundles(): Record<string, EncryptedSecret> {
  const parsed = parseJson(getLocalDatabase().getSetting(TEAM_HUB_DEVICE_KEYS_SETTING), {});
  if (!isPlainObject(parsed)) {
    return {};
  }
  return parsed as Record<string, EncryptedSecret>;
}

/**
 * Persists encrypted Team Hub device bundles to the local registry.
 *
 * @param bundles - Map keyed by team hub connection id.
 */
function writeAllTeamHubDeviceBundles(bundles: Record<string, EncryptedSecret>): void {
  getLocalDatabase().setSetting(TEAM_HUB_DEVICE_KEYS_SETTING, JSON.stringify(bundles));
}

/**
 * Stores encrypted device identity material for a Team Hub connection.
 *
 * @param bundle - Device identity and private key material to encrypt.
 */
export function storeTeamHubDeviceBundle(bundle: StoredTeamHubDeviceBundle): void {
  const all = readAllTeamHubDeviceBundles();
  all[bundle.identity.hubId] = encryptSecret(JSON.stringify(bundle));
  writeAllTeamHubDeviceBundles(all);
}

/**
 * Returns decrypted device identity metadata for a hub connection, if enrolled locally.
 *
 * @param hubId - Team hub connection id.
 */
export function getStoredTeamHubDeviceIdentity(
  hubId: string
): StoredTeamHubDeviceIdentity | undefined {
  const entry = readAllTeamHubDeviceBundles()[hubId];
  if (!entry) {
    return undefined;
  }

  try {
    const parsed = parseJson(decryptSecret(entry), null);
    if (!isPlainObject(parsed) || !isPlainObject(parsed.identity)) {
      return undefined;
    }

    return parsed.identity as unknown as StoredTeamHubDeviceIdentity;
  } catch {
    return undefined;
  }
}

/**
 * Returns decrypted private key material for a hub connection, if enrolled locally.
 *
 * @param hubId - Team hub connection id.
 */
export function getStoredTeamHubDevicePrivateKey(hubId: string): string | undefined {
  const entry = readAllTeamHubDeviceBundles()[hubId];
  if (!entry) {
    return undefined;
  }

  try {
    const parsed = parseJson(decryptSecret(entry), null);
    if (!isPlainObject(parsed) || typeof parsed.privateKeyMaterial !== 'string') {
      return undefined;
    }

    return parsed.privateKeyMaterial;
  } catch {
    return undefined;
  }
}

/**
 * Removes stored device identity material for a Team Hub connection.
 *
 * @param hubId - Team hub connection id.
 */
export function deleteTeamHubDeviceBundle(hubId: string): void {
  const all = readAllTeamHubDeviceBundles();
  if (!all[hubId]) {
    return;
  }

  delete all[hubId];
  writeAllTeamHubDeviceBundles(all);
}

/**
 * Returns hub ids that currently have encrypted device bundles in the sidecar store.
 */
export function listTeamHubDeviceBundleIds(): string[] {
  return Object.keys(readAllTeamHubDeviceBundles());
}

export type { StoredTeamHubDeviceBundle };
