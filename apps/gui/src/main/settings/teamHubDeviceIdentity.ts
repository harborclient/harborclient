import { generateKeyPairSync, randomUUID } from 'node:crypto';
import os from 'node:os';

/**
 * Locally generated device identity material for Team Hub E2EE enrollment.
 */
export interface GeneratedDeviceIdentity {
  /**
   * Client-generated stable device identifier.
   */
  deviceId: string;

  /**
   * Base64-encoded SPKI public key bytes uploaded to Team Hub.
   */
  publicKeyMaterial: string;

  /**
   * Base64-encoded PKCS8 private key bytes stored only in encrypted local storage.
   */
  privateKeyMaterial: string;
}

/**
 * Builds a default device label from the current host name.
 *
 * @returns Human-readable label for operator listings.
 */
export function buildDefaultDeviceLabel(): string {
  const hostname = os.hostname().trim();
  if (hostname.length === 0) {
    return 'HarborClient device';
  }

  return `HarborClient on ${hostname}`;
}

/**
 * Generates a new Ed25519 device identity for Team Hub E2EE enrollment.
 *
 * The server receives only {@link GeneratedDeviceIdentity.publicKeyMaterial}.
 * Private material stays in the main-process encrypted sidecar until MLS wiring lands.
 *
 * @returns Fresh device id and key pair material.
 */
export function generateDeviceIdentity(): GeneratedDeviceIdentity {
  const deviceId = randomUUID();
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    deviceId,
    publicKeyMaterial: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKeyMaterial: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  };
}
