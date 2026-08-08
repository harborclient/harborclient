import type { DiscussionEntityType } from './discussionTypes.js';

/**
 * Collaboration notice event kinds emitted by Team Hub.
 */
export type NoticeEventType =
  | 'request.updated'
  | 'discussion.comment'
  | 'discussion.reply'
  | 'discussion.mention'
  | 'runResult.created'
  | 'runResult.failed';

/**
 * Entity kinds referenced by collaboration notices.
 */
export type NoticeEntityType = DiscussionEntityType;

/**
 * Per-user notification delivery preference.
 */
export type NotificationLevel = 'all' | 'mentions' | 'none';

/**
 * Avatar presentation metadata returned with notice actors.
 */
export interface NoticeActorAvatar {
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
 * Actor metadata attached to a notice row.
 */
export interface NoticeActor {
  /**
   * Stable Team Hub user account identifier.
   */
  id: string;

  /**
   * Display name for the actor.
   */
  name: string;

  /**
   * Avatar presentation when the hub exposes avatar metadata.
   */
  avatar?: NoticeActorAvatar;
}

/**
 * Display metadata denormalized onto notice rows for feed rendering.
 */
export interface NoticeDisplayMetadata {
  /**
   * Display name of the user who triggered the notice event.
   */
  actorName: string;

  /**
   * Human-readable label for the target entity.
   */
  targetLabel: string;

  /**
   * HTTP method for request-scoped notices, when applicable.
   */
  method?: string;

  /**
   * Request display name when distinct from the target label.
   */
  requestName?: string;

  /**
   * Run result label when the notice references a saved run snapshot.
   */
  runLabel?: string;

  /**
   * Optional preview snippet such as the start of a discussion comment body.
   */
  previewText?: string;
}

/**
 * One collaboration notice returned by Team Hub notice routes.
 */
export interface TeamHubNotice {
  /**
   * Stable notice identifier.
   */
  id: string;

  /**
   * Notice event kind for copy and filtering.
   */
  eventType: NoticeEventType;

  /**
   * Primary entity type the notice deep-links to.
   */
  entityType: NoticeEntityType;

  /**
   * Primary entity identifier the notice deep-links to.
   */
  entityId: string;

  /**
   * Related request id, when applicable.
   */
  requestId: string | null;

  /**
   * Related collection id for navigation and access filtering.
   */
  collectionId: string | null;

  /**
   * Related folder id, when applicable.
   */
  folderId: string | null;

  /**
   * Related run result id, when applicable.
   */
  runResultId: string | null;

  /**
   * Root discussion thread id, when applicable.
   */
  discussionThreadId: string | null;

  /**
   * Discussion comment id that triggered the notice, when applicable.
   */
  discussionCommentId: string | null;

  /**
   * Actor who triggered the notice.
   */
  actor: NoticeActor;

  /**
   * ISO 8601 timestamp when the notice was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the notice was read, or null when unread.
   */
  readAt: string | null;

  /**
   * Denormalized labels for feed rendering without extra entity lookups.
   */
  displayMetadata: NoticeDisplayMetadata;
}

/**
 * Paginated list response from `GET /notices`.
 */
export interface ListNoticesResponse {
  /**
   * Notices in reverse-chronological order for the requested page.
   */
  notices: TeamHubNotice[];

  /**
   * Opaque cursor for the next page, when more notices exist.
   */
  nextCursor?: string;
}

/**
 * Query parameters accepted by notice list routes.
 */
export interface ListNoticesQuery {
  /**
   * Pagination cursor from a prior list response.
   */
  cursor?: string;

  /**
   * Maximum number of notices to return.
   */
  limit?: number;
}

/**
 * Response payload from `GET /notices/unread-count`.
 */
export interface NoticesUnreadCountResponse {
  /**
   * Number of unread notices for the authenticated user.
   */
  count: number;
}

/**
 * Current notification settings for the authenticated user.
 */
export interface NotificationSettings {
  /**
   * Delivery preference for collaboration notices.
   */
  level: NotificationLevel;

  /**
   * ISO 8601 timestamp when the settings were last updated.
   */
  updatedAt: string;
}

/**
 * Request body for updating notification settings.
 */
export interface UpdateNotificationSettingsInput {
  /**
   * Replacement notification delivery preference.
   */
  level: NotificationLevel;
}

/**
 * Thread subscription state for the authenticated user.
 */
export interface DiscussionThreadSubscription {
  /**
   * When true, the user receives notices for this discussion thread.
   */
  subscribed: boolean;

  /**
   * Root comment id identifying the thread.
   */
  rootCommentId: string;
}
