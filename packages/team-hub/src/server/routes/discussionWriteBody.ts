import type { FastifyReply } from 'fastify';
import type { CollaborationConfig } from '#/config/collaborationConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { UserRecord } from '#/db/types.js';
import {
  buildEncryptedDiscussionCommentFields,
  type DiscussionEncryptedPayloadInput,
  validateDiscussionEncryptedPayloadInput
} from '#/db/discussionEncryptedPayload.js';
import {
  PLAINTEXT_DISCUSSION_BODY_REJECTED_MESSAGE,
  rejectsPlaintextDiscussionBody
} from '#/server/routes/discussionE2eePolicy.js';
import type { DiscussionWriteBodyInput } from '#/server/routes/schemas/discussions.js';

/**
 * Parsed discussion write payload ready for database persistence.
 */
export interface ParsedDiscussionWriteBody {
  /**
   * Stored body text or ciphertext.
   */
  body: string;

  /**
   * Body encoding format.
   */
  bodyFormat: 'plaintext' | 'encrypted';

  /**
   * Optional encrypted-body metadata.
   */
  bodyMetadata: Record<string, unknown> | null;
}

/**
 * Parses a discussion create/update request body for plaintext or encrypted hubs.
 *
 * @param reply - Fastify reply used to short-circuit invalid requests.
 * @param collaboration - Active collaboration settings for the hub.
 * @param db - Database handle scoped to the active tenant.
 * @param user - Authenticated user performing the write.
 * @param input - Raw request body from the client.
 * @returns Parsed write payload, or null when the handler should return early.
 */
export async function parseDiscussionWriteBody(
  reply: FastifyReply,
  collaboration: CollaborationConfig,
  db: IDatabase,
  user: UserRecord,
  input: DiscussionWriteBodyInput
): Promise<ParsedDiscussionWriteBody | null> {
  if (rejectsPlaintextDiscussionBody(collaboration)) {
    if (input.body != null) {
      void reply.code(400).send({ error: PLAINTEXT_DISCUSSION_BODY_REJECTED_MESSAGE });
      return null;
    }

    if (!input.encryptedPayload) {
      void reply.code(400).send({ error: PLAINTEXT_DISCUSSION_BODY_REJECTED_MESSAGE });
      return null;
    }

    try {
      validateDiscussionEncryptedPayloadInput(input.encryptedPayload);
    } catch (error) {
      void reply.code(400).send({
        error: error instanceof Error ? error.message : 'Invalid encrypted discussion payload'
      });
      return null;
    }

    const device = await db.findActiveDeviceKeyByUserAndDeviceId(
      user.id,
      input.encryptedPayload.senderDeviceId
    );
    if (!device) {
      void reply.code(403).send({ error: 'Sender device is not enrolled on this Team Hub' });
      return null;
    }

    const encrypted = buildEncryptedDiscussionCommentFields(input.encryptedPayload);
    return {
      body: encrypted.body,
      bodyFormat: encrypted.bodyFormat,
      bodyMetadata: encrypted.bodyMetadata
    };
  }

  if (input.encryptedPayload) {
    void reply.code(400).send({
      error: 'Encrypted discussion payloads are only accepted on E2EE-enabled Team Hubs'
    });
    return null;
  }

  if (!input.body?.trim()) {
    void reply.code(400).send({ error: 'Comment body is required' });
    return null;
  }

  return {
    body: input.body.trim(),
    bodyFormat: 'plaintext',
    bodyMetadata: null
  };
}

export type { DiscussionEncryptedPayloadInput };
