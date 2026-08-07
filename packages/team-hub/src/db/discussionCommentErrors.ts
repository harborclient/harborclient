/**
 * Thrown when a discussion comment parent is missing, invalid, or not usable for replies.
 */
export class DiscussionCommentParentError extends Error {
  /**
   * Creates a parent validation error with a stable message for HTTP mapping.
   *
   * @param message - Human-readable reason the parent comment cannot be used.
   */
  constructor(message: string) {
    super(message);
    this.name = 'DiscussionCommentParentError';
  }
}

/**
 * Thrown when a discussion comment cannot be found in the current tenant.
 */
export class DiscussionCommentNotFoundError extends Error {
  /**
   * Creates a not-found error for discussion comment lookups.
   */
  constructor() {
    super('Discussion comment not found');
    this.name = 'DiscussionCommentNotFoundError';
  }
}

/**
 * Thrown when a discussion comment update or tombstone is not permitted.
 */
export class DiscussionCommentForbiddenError extends Error {
  /**
   * Creates a forbidden error for discussion comment mutations.
   *
   * @param message - Human-readable reason the action is denied.
   */
  constructor(message: string) {
    super(message);
    this.name = 'DiscussionCommentForbiddenError';
  }
}
