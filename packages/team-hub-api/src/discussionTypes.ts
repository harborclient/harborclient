/**
 * Entity kinds that can host a Team Hub discussion thread.
 */
export type DiscussionEntityType = 'request' | 'collection' | 'folder' | 'runResult';

/**
 * Avatar presentation metadata returned with discussion authors.
 */
export interface DiscussionAuthorAvatar {
  /**
   * One or two uppercase initials shown in the avatar badge.
   */
  initials: string;

  /**
   * CSS color string for the avatar background.
   */
  color: string;

  /**
   * Relative URL for a uploaded avatar image (for example `/auth/users/{id}/avatar?v=…`).
   *
   * Omitted when the user has not uploaded an image.
   */
  imageUrl?: string;
}

/**
 * Author metadata attached to a discussion comment.
 */
export interface DiscussionAuthor {
  /**
   * Stable Team Hub user account identifier.
   */
  id: string;

  /**
   * Display name for the author.
   */
  name: string;

  /**
   * Avatar presentation when the hub exposes avatar metadata.
   */
  avatar?: DiscussionAuthorAvatar;
}

/**
 * Encrypted discussion payload metadata returned by E2EE Team Hub routes.
 */
export interface DiscussionEncryptedPayloadInput {
  /**
   * Base64-encoded ciphertext bytes stored on the server.
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
  keyFormat: 'identity-v1' | 'mls-v1';

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
 * One discussion comment returned by Team Hub discussion routes.
 */
export interface DiscussionComment {
  /**
   * Stable comment identifier.
   */
  id: string;

  /**
   * Target entity kind for this comment tree.
   */
  entityType: DiscussionEntityType;

  /**
   * Target entity UUID on the Team Hub server.
   */
  entityId: string;

  /**
   * Parent comment id, or null for a top-level comment.
   */
  parentCommentId: string | null;

  /**
   * Root comment id for the thread branch.
   */
  rootCommentId: string;

  /**
   * Nesting depth from 1 through 3.
   */
  depth: number;

  /**
   * Markdown/plain body text, or null when tombstoned or encrypted on the wire.
   */
  body: string | null;

  /**
   * Body encoding format persisted by the server.
   */
  bodyFormat: 'plaintext' | 'encrypted';

  /**
   * Encrypted payload metadata for local decryption on E2EE hubs.
   */
  encryptedPayload?: DiscussionEncryptedPayloadInput | null;

  /**
   * Author metadata for display and permissions.
   */
  author: DiscussionAuthor;

  /**
   * ISO 8601 timestamp when the comment was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the comment was last updated.
   */
  updatedAt: string;

  /**
   * When true, the body was tombstoned and must not be shown.
   */
  tombstoned: boolean;
}

/**
 * Paginated list response from discussion list routes.
 */
export interface ListDiscussionsResponse {
  /**
   * Comments in server sort order for the requested page.
   */
  comments: DiscussionComment[];

  /**
   * Opaque cursor for the next page, when more comments exist.
   */
  nextCursor?: string;
}

/**
 * Query parameters accepted by discussion list routes.
 */
export interface ListDiscussionsQuery {
  /**
   * Pagination cursor from a prior list response.
   */
  cursor?: string;

  /**
   * Maximum number of comments to return.
   */
  limit?: number;
}

/**
 * Request body for creating a top-level discussion comment.
 */
export interface CreateDiscussionCommentInput {
  /**
   * Plaintext comment body for non-E2EE hubs.
   */
  body?: string;

  /**
   * Encrypted payload for E2EE hubs.
   */
  encryptedPayload?: DiscussionEncryptedPayloadInput;

  /**
   * Parent comment id when creating a reply instead of a root comment.
   */
  parentCommentId?: string;
}

/**
 * Request body for updating an existing discussion comment.
 */
export interface UpdateDiscussionCommentInput {
  /**
   * Plaintext replacement body for non-E2EE hubs.
   */
  body?: string;

  /**
   * Encrypted payload for E2EE hubs.
   */
  encryptedPayload?: DiscussionEncryptedPayloadInput;
}
