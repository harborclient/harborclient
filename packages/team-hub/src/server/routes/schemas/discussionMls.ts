import { z } from 'zod/v4';
import type {
  DiscussionMlsCommitRecord,
  DiscussionMlsGroupStateRecord,
  DiscussionMlsWelcomeRecord
} from '#/db/types.js';
import { timestampSchema } from '#/server/routes/schemas/common.js';

/**
 * JSON shape for a persisted MLS commit relay record.
 */
export const discussionMlsCommitSchema = z.object({
  id: z.string(),
  mlsGroupId: z.string(),
  epoch: z.number().int().nonnegative(),
  ciphertext: z.string(),
  senderDeviceId: z.string(),
  createdAt: timestampSchema
});

/**
 * JSON shape for a persisted MLS welcome relay record.
 */
export const discussionMlsWelcomeSchema = z.object({
  id: z.string(),
  mlsGroupId: z.string(),
  recipientDeviceId: z.string(),
  ciphertext: z.string(),
  ratchetTree: z.string(),
  createdAt: timestampSchema
});

/**
 * JSON shape for discussion MLS group state.
 */
export const discussionMlsGroupStateSchema = z.object({
  mlsGroupId: z.string(),
  currentEpoch: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

/**
 * Request body for posting an MLS commit relay record.
 */
export const createDiscussionMlsCommitBodySchema = z.object({
  mlsGroupId: z.string().min(1),
  epoch: z.number().int().nonnegative(),
  ciphertext: z.string().min(1),
  senderDeviceId: z.string().min(1)
});

/**
 * Request body for posting an MLS welcome relay record.
 */
export const createDiscussionMlsWelcomeBodySchema = z.object({
  mlsGroupId: z.string().min(1),
  recipientDeviceId: z.string().min(1),
  ciphertext: z.string().min(1),
  ratchetTree: z.string().min(1)
});

/**
 * Query parameters for listing MLS commits on a discussion thread.
 */
export const listDiscussionMlsCommitsQuerySchema = z.object({
  mlsGroupId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

/**
 * Query parameters for listing MLS welcomes on a discussion thread.
 */
export const listDiscussionMlsWelcomesQuerySchema = z.object({
  mlsGroupId: z.string().min(1),
  recipientDeviceId: z.string().optional()
});

/**
 * Response body for listing MLS commits.
 */
export const listDiscussionMlsCommitsResponseSchema = z.object({
  commits: z.array(discussionMlsCommitSchema),
  nextCursor: z.string().optional()
});

/**
 * Response body for listing MLS welcomes.
 */
export const listDiscussionMlsWelcomesResponseSchema = z.object({
  welcomes: z.array(discussionMlsWelcomeSchema)
});

/**
 * Serializes a persisted MLS commit record for REST responses.
 *
 * @param record - Stored MLS commit row.
 */
export function serializeDiscussionMlsCommit(
  record: DiscussionMlsCommitRecord
): z.infer<typeof discussionMlsCommitSchema> {
  return {
    id: record.id,
    mlsGroupId: record.mlsGroupId,
    epoch: record.epoch,
    ciphertext: record.ciphertext,
    senderDeviceId: record.senderDeviceId,
    createdAt: record.createdAt.toISOString()
  };
}

/**
 * Serializes a persisted MLS welcome record for REST responses.
 *
 * @param record - Stored MLS welcome row.
 */
export function serializeDiscussionMlsWelcome(
  record: DiscussionMlsWelcomeRecord
): z.infer<typeof discussionMlsWelcomeSchema> {
  return {
    id: record.id,
    mlsGroupId: record.mlsGroupId,
    recipientDeviceId: record.recipientDeviceId,
    ciphertext: record.ciphertext,
    ratchetTree: record.ratchetTree,
    createdAt: record.createdAt.toISOString()
  };
}

/**
 * Serializes discussion MLS group state for REST responses.
 *
 * @param record - Stored MLS group state row.
 */
export function serializeDiscussionMlsGroupState(
  record: DiscussionMlsGroupStateRecord
): z.infer<typeof discussionMlsGroupStateSchema> {
  return {
    mlsGroupId: record.mlsGroupId,
    currentEpoch: record.currentEpoch,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
