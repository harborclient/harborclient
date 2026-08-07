/**
 * Persisted MLS commit relay record returned by Team Hub.
 */
export interface DiscussionMlsCommit {
  /**
   * Stable commit record identifier.
   */
  id: string;

  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * MLS epoch after applying the commit.
   */
  epoch: number;

  /**
   * Base64-encoded MLS commit bytes.
   */
  ciphertext: string;

  /**
   * Client device id that produced the commit.
   */
  senderDeviceId: string;

  /**
   * ISO 8601 timestamp when the commit was relayed.
   */
  createdAt: string;
}

/**
 * Persisted MLS welcome relay record returned by Team Hub.
 */
export interface DiscussionMlsWelcome {
  /**
   * Stable welcome record identifier.
   */
  id: string;

  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Recipient device id for the welcome message.
   */
  recipientDeviceId: string;

  /**
   * Base64-encoded MLS welcome bytes.
   */
  ciphertext: string;

  /**
   * Base64-encoded ratchet tree bytes for group join.
   */
  ratchetTree: string;

  /**
   * ISO 8601 timestamp when the welcome was relayed.
   */
  createdAt: string;
}

/**
 * Latest MLS epoch observed for a discussion thread.
 */
export interface DiscussionMlsGroupState {
  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Latest MLS epoch observed for the thread.
   */
  currentEpoch: number;

  /**
   * ISO 8601 timestamp when the group state row was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the group state row was last updated.
   */
  updatedAt: string;
}

/**
 * Request body for posting an MLS commit relay record.
 */
export interface CreateDiscussionMlsCommitInput {
  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * MLS epoch after applying the commit.
   */
  epoch: number;

  /**
   * Base64-encoded MLS commit bytes.
   */
  ciphertext: string;

  /**
   * Client device id that produced the commit.
   */
  senderDeviceId: string;
}

/**
 * Request body for posting an MLS welcome relay record.
 */
export interface CreateDiscussionMlsWelcomeInput {
  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Recipient device id for the welcome message.
   */
  recipientDeviceId: string;

  /**
   * Base64-encoded MLS welcome bytes.
   */
  ciphertext: string;

  /**
   * Base64-encoded ratchet tree bytes for group join.
   */
  ratchetTree: string;
}

/**
 * Query parameters for listing MLS commits on a discussion thread.
 */
export interface ListDiscussionMlsCommitsQuery {
  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Opaque pagination cursor from a prior list response.
   */
  cursor?: string;

  /**
   * Maximum number of commits to return.
   */
  limit?: number;
}

/**
 * Paginated MLS commit list response.
 */
export interface ListDiscussionMlsCommitsResponse {
  /**
   * Commits in ascending epoch order for the requested page.
   */
  commits: DiscussionMlsCommit[];

  /**
   * Opaque cursor for the next page, when more commits exist.
   */
  nextCursor?: string;
}

/**
 * Query parameters for listing MLS welcomes on a discussion thread.
 */
export interface ListDiscussionMlsWelcomesQuery {
  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Optional recipient device id filter.
   */
  recipientDeviceId?: string;
}

/**
 * Paginated MLS welcome list response.
 */
export interface ListDiscussionMlsWelcomesResponse {
  /**
   * Welcome records in creation order for the requested page.
   */
  welcomes: DiscussionMlsWelcome[];
}
