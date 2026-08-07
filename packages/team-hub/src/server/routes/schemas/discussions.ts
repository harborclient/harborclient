import { z } from 'zod/v4';
import type { CollaborationConfig } from '#/config/collaborationConfig.js';
import type { DiscussionCommentRecord, DiscussionTargetEntityType } from '#/db/types.js';
import {
  parseDiscussionEncryptedBodyMetadata,
  serializeDiscussionEncryptedPayloadForClient
} from '#/db/discussionEncryptedPayload.js';
import { isDiscussionCommentTombstoned } from '#/db/discussionCommentLogic.js';
import { serializeDiscussionBodyForClient } from '#/server/routes/discussionE2eePolicy.js';
import { timestampSchema } from '#/server/routes/schemas/common.js';
import type { DiscussionAuthorPayload } from '#/server/routes/schemas/userAuthor.js';

/**
 * Valid target entity types for Team Hub discussion threads.
 */
export const discussionEntityTypeSchema = z.enum([
  'request',
  'collection',
  'folder',
  'runResult'
]) satisfies z.ZodType<DiscussionTargetEntityType>;

/**
 * Avatar metadata attached to discussion authors.
 */
export const discussionAuthorAvatarSchema = z.object({
  initials: z.string(),
  color: z.string()
});

/**
 * Author metadata attached to discussion comments.
 */
export const discussionAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: discussionAuthorAvatarSchema.optional()
});

/**
 * Encrypted discussion payload metadata returned to clients for local decryption.
 */
export const encryptedDiscussionPayloadSchema = z.object({
  ciphertext: z.string(),
  mlsGroupId: z.string(),
  epoch: z.number().int().nonnegative(),
  senderDeviceId: z.string(),
  keyFormat: z.enum(['identity-v1', 'mls-v1']),
  commitRef: z.string().optional(),
  welcomeRef: z.string().optional()
});

/**
 * JSON shape for a discussion comment returned by REST routes.
 */
export const discussionCommentSchema = z.object({
  id: z.string(),
  entityType: discussionEntityTypeSchema,
  entityId: z.string(),
  parentCommentId: z.string().nullable(),
  rootCommentId: z.string(),
  depth: z.number().int().min(1).max(3),
  body: z.string().nullable(),
  bodyFormat: z.enum(['plaintext', 'encrypted']),
  encryptedPayload: encryptedDiscussionPayloadSchema.nullable().optional(),
  author: discussionAuthorSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  tombstoned: z.boolean()
});

/**
 * Request body for creating, replying to, or updating discussion comments.
 */
export const discussionWriteBodySchema = z.object({
  body: z.string().min(1).optional(),
  encryptedPayload: encryptedDiscussionPayloadSchema.optional()
});

/**
 * Request body for creating a top-level discussion comment.
 */
export const createDiscussionCommentBodySchema = discussionWriteBodySchema;

/**
 * Request body for creating a reply to an existing discussion comment.
 */
export const createDiscussionReplyBodySchema = discussionWriteBodySchema;

/**
 * Request body for updating a discussion comment body.
 */
export const updateDiscussionCommentBodySchema = discussionWriteBodySchema;

/**
 * Parsed discussion write request body accepted by create/update routes.
 */
export type DiscussionWriteBodyInput = z.infer<typeof discussionWriteBodySchema>;

/**
 * Query parameters for listing discussion comments with cursor pagination.
 */
export const listDiscussionCommentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

/**
 * Response body for listing discussion comments on a target entity.
 */
export const listDiscussionCommentsResponseSchema = z.object({
  comments: z.array(discussionCommentSchema),
  nextCursor: z.string().optional()
});

/**
 * Serializes a discussion comment for REST responses, hiding tombstoned bodies.
 *
 * @param record - Stored discussion comment row.
 * @param author - Resolved author display metadata.
 * @param collaboration - Active collaboration settings for the hub.
 * @returns JSON-safe discussion comment payload.
 */
export function serializeDiscussionComment(
  record: DiscussionCommentRecord,
  author: DiscussionAuthorPayload,
  collaboration: CollaborationConfig
): z.infer<typeof discussionCommentSchema> {
  const tombstoned = isDiscussionCommentTombstoned(record);
  const encryptedMetadata = parseDiscussionEncryptedBodyMetadata(record.bodyMetadata);

  return {
    id: record.id,
    entityType: record.targetEntityType,
    entityId: record.targetEntityId,
    parentCommentId: record.parentCommentId,
    rootCommentId: record.rootCommentId,
    depth: record.depth,
    body: tombstoned ? null : serializeDiscussionBodyForClient(record, collaboration),
    bodyFormat: record.bodyFormat,
    encryptedPayload:
      !tombstoned && record.bodyFormat === 'encrypted' && encryptedMetadata
        ? serializeDiscussionEncryptedPayloadForClient(record.body, encryptedMetadata)
        : null,
    author,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    tombstoned
  };
}
