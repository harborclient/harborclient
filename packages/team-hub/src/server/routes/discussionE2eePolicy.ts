import type { CollaborationConfig } from '#/config/collaborationConfig.js';
import type { DiscussionCommentRecord } from '#/db/types.js';
import { isDiscussionCommentTombstoned } from '#/db/discussionCommentLogic.js';

/**
 * Error message returned when plaintext discussion bodies are rejected on an E2EE hub.
 */
export const PLAINTEXT_DISCUSSION_BODY_REJECTED_MESSAGE =
  'Plaintext discussion bodies are not accepted on this Team Hub. Encrypted payloads are required.';

/**
 * Returns true when the hub requires encrypted discussion comment bodies.
 *
 * @param config - Active collaboration settings for the hub.
 */
export function isDiscussionE2eeRequired(config: CollaborationConfig): boolean {
  return config.e2ee;
}

/**
 * Returns true when a create or update request attempted to send a plaintext body.
 *
 * @param config - Active collaboration settings for the hub.
 */
export function rejectsPlaintextDiscussionBody(config: CollaborationConfig): boolean {
  return config.e2ee;
}

/**
 * Serializes a discussion comment body for REST clients.
 *
 * Tombstoned, encrypted, and E2EE-hub plaintext bodies are never exposed as readable text.
 *
 * @param record - Stored discussion comment row.
 * @param config - Active collaboration settings for the hub.
 */
export function serializeDiscussionBodyForClient(
  record: DiscussionCommentRecord,
  config: CollaborationConfig
): string | null {
  if (isDiscussionCommentTombstoned(record)) {
    return null;
  }

  if (record.bodyFormat === 'encrypted') {
    return null;
  }

  if (config.e2ee) {
    return null;
  }

  return record.body;
}
