import type { HubDeviceKeyRecord, TeamHub } from '@harborclient/core/types';
import {
  TeamHubClientError,
  isTeamHubDeviceEnrollmentDisabledError
} from '@harborclient/team-hub-api';
import { createTeamHubClient } from './teamHubClient';
import { buildDefaultDeviceLabel, generateDeviceIdentity } from './teamHubDeviceIdentity';
import {
  deleteTeamHubDeviceBundle,
  getStoredTeamHubDeviceIdentity,
  storeTeamHubDeviceBundle,
  type StoredTeamHubDeviceIdentity
} from './teamHubDeviceKeys';

/**
 * Enrollment status for the current device on one Team Hub connection.
 */
export interface TeamHubDeviceEnrollmentStatus {
  /**
   * True when local encrypted keys exist for this hub.
   */
  hasLocalIdentity: boolean;

  /**
   * True when the server reports an active enrollment for the local device id.
   */
  isEnrolledOnServer: boolean;

  /**
   * True when the local device id matches an active, non-revoked server record.
   */
  isActiveEnrollment: boolean;

  /**
   * Locally stored identity metadata, if present.
   */
  localIdentity?: StoredTeamHubDeviceIdentity;

  /**
   * Matching server enrollment record, if present.
   */
  serverDevice?: HubDeviceKeyRecord;
}

/**
 * Resolves enrollment status by comparing local storage with hub device listings.
 *
 * @param hub - Team hub connection to inspect.
 * @returns Local/server enrollment flags and matching records when available.
 */
export async function getTeamHubDeviceEnrollmentStatus(
  hub: TeamHub
): Promise<TeamHubDeviceEnrollmentStatus> {
  const localIdentity = getStoredTeamHubDeviceIdentity(hub.id);
  if (!localIdentity) {
    return {
      hasLocalIdentity: false,
      isEnrolledOnServer: false,
      isActiveEnrollment: false
    };
  }

  const client = createTeamHubClient(hub);

  try {
    const devices = await client.listMyDevices();
    const serverDevice = devices.find((device) => device.deviceId === localIdentity.deviceId);
    const isActiveEnrollment = serverDevice?.revokedAt == null;

    return {
      hasLocalIdentity: true,
      isEnrolledOnServer: serverDevice != null,
      isActiveEnrollment,
      localIdentity,
      serverDevice
    };
  } catch (error) {
    if (error instanceof TeamHubClientError && error.status === 404) {
      return {
        hasLocalIdentity: true,
        isEnrolledOnServer: false,
        isActiveEnrollment: false,
        localIdentity
      };
    }

    throw error;
  }
}

/**
 * Generates local device keys and uploads public material to an E2EE-enabled hub.
 *
 * @param hub - Team hub connection to enroll against.
 * @param label - Optional device label; defaults to a host-based label.
 * @returns Stored local identity and server enrollment metadata.
 */
export async function enrollTeamHubDevice(
  hub: TeamHub,
  label?: string
): Promise<{ localIdentity: StoredTeamHubDeviceIdentity; serverDevice: HubDeviceKeyRecord }> {
  const identity = generateDeviceIdentity();
  const deviceLabel = label?.trim() || buildDefaultDeviceLabel();
  const client = createTeamHubClient(hub);
  const session = await client.getSession();
  const serverDevice = await client.enrollDevice({
    deviceId: identity.deviceId,
    label: deviceLabel,
    publicKeyMaterial: identity.publicKeyMaterial,
    keyFormat: 'identity-v1'
  });

  const localIdentity: StoredTeamHubDeviceIdentity = {
    hubId: hub.id,
    userId: session.user.id,
    deviceId: identity.deviceId,
    serverDeviceKeyId: serverDevice.id,
    label: deviceLabel,
    fingerprint: serverDevice.fingerprint,
    enrolledAt: new Date().toISOString()
  };

  storeTeamHubDeviceBundle({
    identity: localIdentity,
    privateKeyMaterial: identity.privateKeyMaterial
  });

  return { localIdentity, serverDevice };
}

/**
 * Clears local device keys and optionally revokes the server enrollment.
 *
 * @param hub - Team hub connection whose device keys should be reset.
 * @param revokeOnServer - When true, revokes the stored server record before wiping local keys.
 */
export async function resetTeamHubDeviceKeys(hub: TeamHub, revokeOnServer = true): Promise<void> {
  const localIdentity = getStoredTeamHubDeviceIdentity(hub.id);
  if (revokeOnServer && localIdentity?.serverDeviceKeyId) {
    const client = createTeamHubClient(hub);
    try {
      await client.revokeMyDevice(localIdentity.serverDeviceKeyId);
    } catch (error) {
      if (!(error instanceof TeamHubClientError && error.status === 404)) {
        throw error;
      }
    }
  }

  deleteTeamHubDeviceBundle(hub.id);
}

/**
 * Revokes a device key record through the hub management API.
 *
 * @param hub - Admin team hub connection.
 * @param deviceKeyId - Server-side device key record identifier.
 */
export async function revokeAdminTeamHubDeviceKey(
  hub: TeamHub,
  deviceKeyId: string
): Promise<void> {
  const client = createTeamHubClient(hub);
  await client.revokeAdminDeviceKey(deviceKeyId);
}

/**
 * Lists all device key enrollments through the hub management API.
 *
 * When discussion E2EE is disabled, the hub returns 404 for device routes; that
 * is an expected configuration state, so this returns an empty list instead of
 * surfacing an operator-facing error.
 *
 * @param hub - Admin team hub connection.
 */
export async function listAdminTeamHubDeviceKeys(hub: TeamHub): Promise<HubDeviceKeyRecord[]> {
  const client = createTeamHubClient(hub);
  try {
    return await client.listAdminDeviceKeys();
  } catch (error) {
    if (isTeamHubDeviceEnrollmentDisabledError(error)) {
      return [];
    }

    throw error;
  }
}
