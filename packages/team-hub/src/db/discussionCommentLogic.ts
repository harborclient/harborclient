import {
  DiscussionCommentForbiddenError,
  DiscussionCommentParentError
} from '#/db/discussionCommentErrors.js';
import type {
  CreateDiscussionCommentInput,
  DiscussionBodyFormat,
  DiscussionCommentRecord,
  DiscussionTargetEntityType
} from '#/db/types.js';

/**
 * Maximum nesting depth stored for discussion threads.
 */
export const DISCUSSION_MAX_DEPTH = 3 as const;

/**
 * Resolved tree metadata applied when persisting a new discussion comment.
 */
export interface ResolvedDiscussionPlacement {
  /**
   * Parent comment id after depth flattening, or null for top-level comments.
   */
  parentCommentId: string | null;

  /**
   * Root thread id used for grouping and pagination.
   */
  rootCommentId: string;

  /**
   * Stored depth after server-side flattening (1 through 3).
   */
  depth: 1 | 2 | 3;
}

/**
 * Input for resolving placement of a new discussion comment.
 */
export interface ResolveDiscussionPlacementInput {
  /**
   * Pre-generated id for the comment being created.
   */
  commentId: string;

  /**
   * Parent comment when creating a reply; null for top-level comments.
   */
  parent: DiscussionCommentRecord | null;
}

/**
 * Returns true when a discussion comment has been tombstoned.
 *
 * @param record - Stored discussion comment row.
 * @returns True when tombstone metadata is present.
 */
export function isDiscussionCommentTombstoned(record: DiscussionCommentRecord): boolean {
  return record.tombstonedAt != null;
}

/**
 * Resolves effective parent, root, and depth for a new discussion comment.
 *
 * Depth-4 replies are flattened as siblings under the depth-2 parent.
 *
 * @param input - New comment id and optional parent record.
 * @returns Placement metadata to persist on the new comment.
 */
export function resolveDiscussionPlacement(
  input: ResolveDiscussionPlacementInput
): ResolvedDiscussionPlacement {
  if (!input.parent) {
    return {
      parentCommentId: null,
      rootCommentId: input.commentId,
      depth: 1
    };
  }

  if (input.parent.depth === 1) {
    return {
      parentCommentId: input.parent.id,
      rootCommentId: input.parent.rootCommentId,
      depth: 2
    };
  }

  if (input.parent.depth === 2) {
    return {
      parentCommentId: input.parent.id,
      rootCommentId: input.parent.rootCommentId,
      depth: 3
    };
  }

  if (input.parent.depth !== 3 || !input.parent.parentCommentId) {
    throw new DiscussionCommentParentError('Invalid parent comment depth');
  }

  return {
    parentCommentId: input.parent.parentCommentId,
    rootCommentId: input.parent.rootCommentId,
    depth: 3
  };
}

/**
 * Validates that a parent comment can anchor a reply on the requested target entity.
 *
 * @param parent - Parent comment record loaded from storage.
 * @param targetEntityType - Entity type for the new comment.
 * @param targetEntityId - Entity id for the new comment.
 * @throws DiscussionCommentParentError when the parent cannot be used.
 */
export function assertDiscussionParentValid(
  parent: DiscussionCommentRecord,
  targetEntityType: DiscussionTargetEntityType,
  targetEntityId: string
): void {
  if (isDiscussionCommentTombstoned(parent)) {
    throw new DiscussionCommentParentError('Cannot reply to a deleted comment');
  }

  if (parent.targetEntityType !== targetEntityType || parent.targetEntityId !== targetEntityId) {
    throw new DiscussionCommentParentError('Parent comment belongs to a different target entity');
  }
}

/**
 * Validates that a discussion comment body is non-empty after trimming.
 *
 * @param body - Raw comment body from the client.
 * @throws DiscussionCommentForbiddenError when the body is empty.
 */
export function assertDiscussionBodyPresent(body: string): void {
  if (!body.trim()) {
    throw new DiscussionCommentForbiddenError('Comment body is required');
  }
}

/**
 * Prepared row values for inserting a new discussion comment.
 */
export interface PreparedDiscussionCommentInsert {
  /**
   * Pre-generated comment id.
   */
  id: string;

  /**
   * Target entity type for the comment thread.
   */
  targetEntityType: DiscussionTargetEntityType;

  /**
   * Target entity id for the comment thread.
   */
  targetEntityId: string;

  /**
   * Resolved parent comment id after depth flattening.
   */
  parentCommentId: string | null;

  /**
   * Root thread id for grouping and pagination.
   */
  rootCommentId: string;

  /**
   * Stored depth after server-side flattening.
   */
  depth: 1 | 2 | 3;

  /**
   * Trimmed comment body text.
   */
  body: string;

  /**
   * Body encoding format.
   */
  bodyFormat: DiscussionBodyFormat;

  /**
   * Optional metadata for encrypted or enriched bodies.
   */
  bodyMetadata: Record<string, unknown> | null;

  /**
   * Author user id.
   */
  authorUserId: string;

  /**
   * Creation timestamp.
   */
  createdAt: Date;

  /**
   * Last update timestamp.
   */
  updatedAt: Date;
}

/**
 * Builds insert values for a new discussion comment after validating input and placement.
 *
 * @param input - Create payload from the API or database caller.
 * @param actingUserId - User creating the comment.
 * @param parent - Loaded parent comment when replying.
 * @param commentId - Pre-generated stable comment id.
 * @param now - Timestamp used for createdAt and updatedAt.
 * @returns Values ready for persistence.
 */
export function prepareDiscussionCommentInsert(
  input: CreateDiscussionCommentInput,
  actingUserId: string,
  parent: DiscussionCommentRecord | null,
  commentId: string,
  now: Date
): PreparedDiscussionCommentInsert {
  assertDiscussionBodyPresent(input.body);

  if (input.parentCommentId && !parent) {
    throw new DiscussionCommentParentError('Parent comment not found');
  }

  if (parent) {
    assertDiscussionParentValid(parent, input.targetEntityType, input.targetEntityId);
  } else if (input.parentCommentId) {
    throw new DiscussionCommentParentError('Parent comment not found');
  }

  const placement = resolveDiscussionPlacement({ commentId, parent });

  return {
    id: commentId,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    parentCommentId: placement.parentCommentId,
    rootCommentId: placement.rootCommentId,
    depth: placement.depth,
    body: input.body.trim(),
    bodyFormat: input.bodyFormat ?? 'plaintext',
    bodyMetadata: input.bodyMetadata ?? null,
    authorUserId: actingUserId,
    createdAt: now,
    updatedAt: now
  };
}
