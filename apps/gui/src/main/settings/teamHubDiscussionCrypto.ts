import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type {
  DiscussionComment,
  DiscussionEncryptedPayloadInput,
  DiscussionEntityType
} from '@harborclient/team-hub-api';

/**
 * HKDF info string for the identity-v1 discussion encryption placeholder.
 */
const IDENTITY_V1_HKDF_INFO = 'harborclient-discussion-identity-v1';

/**
 * Builds the canonical MLS group id for an entity-scoped discussion thread.
 *
 * @param entityType - Entity type hosting the discussion.
 * @param entityId - Entity id hosting the discussion.
 * @returns Stable MLS group identifier string.
 */
export function buildDiscussionMlsGroupId(
  entityType: DiscussionEntityType,
  entityId: string
): string {
  return `thread:${entityType}:${entityId}`;
}

/**
 * Derives the AES-256 key used by the identity-v1 discussion encryption placeholder.
 *
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for the enrolled device.
 * @param mlsGroupId - MLS group identifier for the discussion thread.
 * @returns 32-byte AES key material.
 */
function deriveIdentityV1DiscussionKey(privateKeyMaterial: string, mlsGroupId: string): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(privateKeyMaterial, 'base64'),
      Buffer.from(mlsGroupId, 'utf8'),
      IDENTITY_V1_HKDF_INFO,
      32
    )
  );
}

/**
 * Encrypts a discussion body with AES-256-GCM using the identity-v1 placeholder scheme.
 *
 * @param plaintext - Comment body text to encrypt.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for the enrolled device.
 * @param mlsGroupId - MLS group identifier for the discussion thread.
 * @returns Base64 payload containing IV, auth tag, and ciphertext bytes.
 */
export function encryptDiscussionBodyIdentityV1(
  plaintext: string,
  privateKeyMaterial: string,
  mlsGroupId: string
): string {
  const key = deriveIdentityV1DiscussionKey(privateKeyMaterial, mlsGroupId);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Decrypts an identity-v1 encrypted discussion body.
 *
 * @param encoded - Base64 payload containing IV, auth tag, and ciphertext bytes.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for the enrolled device.
 * @param mlsGroupId - MLS group identifier for the discussion thread.
 * @returns Decrypted comment body text.
 */
export function decryptDiscussionBodyIdentityV1(
  encoded: string,
  privateKeyMaterial: string,
  mlsGroupId: string
): string {
  const payload = Buffer.from(encoded, 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const key = deriveIdentityV1DiscussionKey(privateKeyMaterial, mlsGroupId);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Builds an encrypted discussion payload for create/update requests on E2EE hubs.
 *
 * @param plaintext - Comment body text to encrypt.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for the enrolled device.
 * @param deviceId - Enrolled client device identifier.
 * @param mlsGroupId - MLS group identifier for the discussion thread.
 * @param epoch - MLS epoch placeholder until Task 4.5 lands.
 * @returns Encrypted payload accepted by Team Hub discussion write routes.
 */
export function buildEncryptedDiscussionPayload(
  plaintext: string,
  privateKeyMaterial: string,
  deviceId: string,
  mlsGroupId: string,
  epoch = 0
): DiscussionEncryptedPayloadInput {
  return {
    ciphertext: encryptDiscussionBodyIdentityV1(plaintext, privateKeyMaterial, mlsGroupId),
    mlsGroupId,
    epoch,
    senderDeviceId: deviceId,
    keyFormat: 'identity-v1'
  };
}

/**
 * Decrypts an encrypted discussion comment for renderer display when local keys exist.
 *
 * @param comment - Comment returned by Team Hub discussion routes.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for the enrolled device.
 * @returns Comment with decrypted {@link DiscussionComment.body} when possible.
 */
export function decryptDiscussionCommentBody(
  comment: DiscussionComment,
  privateKeyMaterial: string
): DiscussionComment {
  if (
    comment.tombstoned ||
    comment.bodyFormat !== 'encrypted' ||
    comment.encryptedPayload == null
  ) {
    return comment;
  }

  if (comment.encryptedPayload.keyFormat !== 'identity-v1') {
    return { ...comment, body: null };
  }

  try {
    const body = decryptDiscussionBodyIdentityV1(
      comment.encryptedPayload.ciphertext,
      privateKeyMaterial,
      comment.encryptedPayload.mlsGroupId
    );
    return { ...comment, body };
  } catch {
    return { ...comment, body: null };
  }
}
