import type { DiscussionBodyFormat, DiscussionTargetEntityType } from '#/db/types.js';

/**
 * Supported encrypted discussion payload formats stored in {@link DiscussionEncryptedBodyMetadata}.
 */
export type DiscussionEncryptedKeyFormat = 'identity-v1' | 'mls-v1';

/**
 * Metadata persisted alongside ciphertext for encrypted discussion comments.
 */
export interface DiscussionEncryptedBodyMetadata {
  /**
   * Schema version for forward-compatible parsing.
   */
  version: 1;

  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * MLS epoch at encryption time.
   */
  epoch: number;

  /**
   * Client device id that produced the ciphertext.
   */
  senderDeviceId: string;

  /**
   * Encryption format used for the ciphertext in {@link DiscussionCommentRecord.body}.
   */
  keyFormat: DiscussionEncryptedKeyFormat;

  /**
   * Optional MLS commit reference for offline catch-up (Task 4.5).
   */
  commitRef?: string;

  /**
   * Optional MLS welcome reference for device enrollment (Task 4.5).
   */
  welcomeRef?: string;
}

/**
 * Encrypted payload supplied by clients when creating or updating E2EE comments.
 */
export interface DiscussionEncryptedPayloadInput {
  /**
   * Base64-encoded ciphertext bytes stored in the comment body column.
   */
  ciphertext: string;

  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * MLS epoch at encryption time.
   */
  epoch: number;

  /**
   * Client device id that produced the ciphertext.
   */
  senderDeviceId: string;

  /**
   * Encryption format used for the ciphertext.
   */
  keyFormat: DiscussionEncryptedKeyFormat;

  /**
   * Optional MLS commit reference for offline catch-up.
   */
  commitRef?: string;

  /**
   * Optional MLS welcome reference for device enrollment.
   */
  welcomeRef?: string;
}

/**
 * Maximum byte length accepted for base64 ciphertext payloads.
 */
export const MAX_DISCUSSION_CIPHERTEXT_LENGTH = 262_144;

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Builds the canonical MLS group id for an entity-scoped discussion thread.
 *
 * @param targetEntityType - Entity type hosting the discussion.
 * @param targetEntityId - Entity id hosting the discussion.
 * @returns Stable MLS group identifier string.
 */
export function buildDiscussionMlsGroupId(
  targetEntityType: DiscussionTargetEntityType,
  targetEntityId: string
): string {
  return `thread:${targetEntityType}:${targetEntityId}`;
}

/**
 * Parses untrusted JSON metadata into a normalized encrypted-body metadata object.
 *
 * @param value - Raw metadata persisted on a discussion comment row.
 * @returns Parsed metadata or null when the value is absent or invalid.
 */
export function parseDiscussionEncryptedBodyMetadata(
  value: Record<string, unknown> | null
): DiscussionEncryptedBodyMetadata | null {
  if (!value || value.version !== 1) {
    return null;
  }

  if (typeof value.mlsGroupId !== 'string' || value.mlsGroupId.trim().length === 0) {
    return null;
  }

  if (typeof value.epoch !== 'number' || !Number.isInteger(value.epoch) || value.epoch < 0) {
    return null;
  }

  if (typeof value.senderDeviceId !== 'string' || !UUID_V4_PATTERN.test(value.senderDeviceId)) {
    return null;
  }

  if (value.keyFormat !== 'identity-v1' && value.keyFormat !== 'mls-v1') {
    return null;
  }

  return {
    version: 1,
    mlsGroupId: value.mlsGroupId.trim(),
    epoch: value.epoch,
    senderDeviceId: value.senderDeviceId,
    keyFormat: value.keyFormat,
    ...(typeof value.commitRef === 'string' && value.commitRef.trim().length > 0
      ? { commitRef: value.commitRef.trim() }
      : {}),
    ...(typeof value.welcomeRef === 'string' && value.welcomeRef.trim().length > 0
      ? { welcomeRef: value.welcomeRef.trim() }
      : {})
  };
}

/**
 * Validates client-supplied encrypted payload fields before persistence.
 *
 * @param input - Encrypted payload from an authenticated client.
 * @throws Error When any field is missing or out of range.
 */
export function validateDiscussionEncryptedPayloadInput(
  input: DiscussionEncryptedPayloadInput
): void {
  const ciphertext = input.ciphertext.trim();
  if (ciphertext.length === 0) {
    throw new Error('Encrypted discussion ciphertext is required');
  }

  if (ciphertext.length > MAX_DISCUSSION_CIPHERTEXT_LENGTH) {
    throw new Error('Encrypted discussion ciphertext is too large');
  }

  const mlsGroupId = input.mlsGroupId.trim();
  if (mlsGroupId.length === 0) {
    throw new Error('MLS group id is required');
  }

  if (!Number.isInteger(input.epoch) || input.epoch < 0) {
    throw new Error('MLS epoch must be a non-negative integer');
  }

  if (!UUID_V4_PATTERN.test(input.senderDeviceId)) {
    throw new Error('Sender device id must be a UUID v4 value');
  }

  if (input.keyFormat !== 'identity-v1' && input.keyFormat !== 'mls-v1') {
    throw new Error('Unsupported encrypted discussion key format');
  }
}

/**
 * Converts validated encrypted payload input into persisted comment fields.
 *
 * @param input - Encrypted payload from an authenticated client.
 * @returns Body text, format, and metadata ready for database insertion.
 */
export function buildEncryptedDiscussionCommentFields(input: DiscussionEncryptedPayloadInput): {
  body: string;
  bodyFormat: DiscussionBodyFormat;
  bodyMetadata: DiscussionEncryptedBodyMetadata;
} {
  validateDiscussionEncryptedPayloadInput(input);

  return {
    body: input.ciphertext.trim(),
    bodyFormat: 'encrypted',
    bodyMetadata: {
      version: 1,
      mlsGroupId: input.mlsGroupId.trim(),
      epoch: input.epoch,
      senderDeviceId: input.senderDeviceId,
      keyFormat: input.keyFormat,
      ...(input.commitRef?.trim() ? { commitRef: input.commitRef.trim() } : {}),
      ...(input.welcomeRef?.trim() ? { welcomeRef: input.welcomeRef.trim() } : {})
    }
  };
}

/**
 * Serializes encrypted payload metadata for REST clients without exposing plaintext.
 *
 * @param body - Stored ciphertext from the comment body column.
 * @param metadata - Parsed encrypted-body metadata.
 * @returns Client-visible encrypted payload descriptor.
 */
export function serializeDiscussionEncryptedPayloadForClient(
  body: string,
  metadata: DiscussionEncryptedBodyMetadata
): DiscussionEncryptedPayloadInput {
  return {
    ciphertext: body,
    mlsGroupId: metadata.mlsGroupId,
    epoch: metadata.epoch,
    senderDeviceId: metadata.senderDeviceId,
    keyFormat: metadata.keyFormat,
    ...(metadata.commitRef ? { commitRef: metadata.commitRef } : {}),
    ...(metadata.welcomeRef ? { welcomeRef: metadata.welcomeRef } : {})
  };
}
