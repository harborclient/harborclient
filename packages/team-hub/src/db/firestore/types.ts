import type {
  AuditAction,
  AuthConfig,
  KeyValue,
  RunResultKind,
  RunResultSummaryCounts,
  UserRole,
  Variable
} from '#/db/types.js';

/**
 * Validated configuration for a Firestore database connection.
 */
export interface FirestoreDatabaseConfig {
  /**
   * Google Cloud project ID that owns the Firestore database.
   */
  projectId: string;

  /**
   * Optional path to a service account key JSON file.
   */
  keyFilename?: string;
}

/**
 * Firestore document shape for persisted tenant namespaces.
 */
export interface FirestoreTenantDocument {
  /**
   * Human-readable tenant label for operator listings.
   */
  name: string;

  /**
   * When the tenant was created.
   */
  createdAt: Date;

  /**
   * When the tenant was last updated.
   */
  updatedAt: Date;

  /**
   * User who created the tenant, when known.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the tenant, when known.
   */
  updatedByUserId: string | null;

  /**
   * Persisted hub avatar initials tile text, when assigned.
   */
  avatarInitials?: string | null;

  /**
   * Persisted hub avatar background color key (for example `sky-600`).
   */
  avatarColor?: string | null;
}

/**
 * Firestore document shape for persisted user accounts.
 */
export interface FirestoreUserDocument {
  /**
   * Tenant namespace identifier scoping this user account.
   */
  tenantId?: string;

  /**
   * Unique display name for the account.
   */
  name: string;

  /**
   * Role assigned to the account.
   */
  role: UserRole;

  /**
   * Collection ids the user may access, or `['*']` for all collections.
   */
  collectionAccess: string[];

  /**
   * Environment ids the user may access, or `['*']` for all environments.
   */
  environmentAccess: string[];

  /**
   * Snippet ids the user may access, or `['*']` for all snippets.
   */
  snippetAccess: string[];

  /**
   * Live server ids the user may access.
   */
  liveServerAccess: string[];

  /**
   * Live page ids the user may access.
   */
  livePageAccess: string[];

  /**
   * When the user account was created.
   */
  createdAt: Date;

  /**
   * When the user account was last updated.
   */
  updatedAt: Date;

  /**
   * User who created the account.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the account.
   */
  updatedByUserId: string | null;

  /**
   * When true, the user may call hub-proxied LLM routes.
   */
  llmAccess?: boolean;

  /**
   * LLM model ids the user may use, or `['*']` for all hub-offered models.
   */
  llmModels?: string[];

  /**
   * Maximum total tokens per UTC calendar month, or null for unlimited.
   */
  llmMonthlyTokenLimit?: number | null;

  /**
   * Persisted avatar initials tile text, when assigned.
   */
  avatarInitials?: string | null;

  /**
   * Persisted avatar background color key (for example `sky-600`).
   */
  avatarColor?: string | null;
}

/**
 * Firestore document shape for persisted user onboarding invitations.
 */
export interface FirestoreInvitationDocument {
  /**
   * Tenant namespace identifier scoping this invitation.
   */
  tenantId?: string;

  /**
   * Invited user identifier.
   */
  userId: string;

  /**
   * sha256 hex digest of the invitation secret.
   */
  codeHash: string;

  /**
   * Non-secret prefix shown in listings.
   */
  codePrefix: string;

  /**
   * When the invitation stops being redeemable.
   */
  expiresAt: Date;

  /**
   * When the invitation was redeemed; null means still pending or revoked.
   */
  redeemedAt: Date | null;

  /**
   * When the invitation was revoked; null means not revoked.
   */
  revokedAt: Date | null;

  /**
   * When the invitation was created.
   */
  createdAt: Date;

  /**
   * User who created the invitation.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the invitation.
   */
  updatedByUserId: string | null;
}

/**
 * Firestore document shape for persisted API tokens.
 */
export interface FirestoreApiTokenDocument {
  /**
   * Tenant namespace identifier scoping this token.
   */
  tenantId?: string;

  /**
   * Owning user identifier.
   */
  userId: string;

  /**
   * Human-readable token label.
   */
  name: string;

  /**
   * sha256 hex digest of the bearer token secret.
   */
  tokenHash: string;

  /**
   * Non-secret prefix shown in listings.
   */
  tokenPrefix: string;

  /**
   * When the token was created.
   */
  createdAt: Date;

  /**
   * When the token was last used to authenticate a request, if ever.
   */
  lastUsedAt: Date | null;

  /**
   * When the token was revoked; null means the token is still active.
   */
  revokedAt: Date | null;

  /**
   * User who created the token record.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the token record.
   */
  updatedByUserId: string | null;
}

/**
 * Firestore document shape for persisted device key enrollments.
 */
export interface FirestoreDeviceKeyDocument {
  /**
   * Tenant namespace identifier scoping this enrollment.
   */
  tenantId?: string;

  /**
   * Owning user identifier.
   */
  userId: string;

  /**
   * Client-generated stable device identifier.
   */
  deviceId: string;

  /**
   * Human-readable device label.
   */
  label: string;

  /**
   * Format of {@link publicKeyMaterial}.
   */
  keyFormat: string;

  /**
   * Base64-encoded public key material or MLS KeyPackage bytes.
   */
  publicKeyMaterial: string;

  /**
   * sha256 hex digest of {@link publicKeyMaterial}.
   */
  fingerprint: string;

  /**
   * When the device was enrolled.
   */
  createdAt: Date;

  /**
   * When the device last confirmed enrollment, if tracked.
   */
  lastSeenAt: Date | null;

  /**
   * When the device was revoked; null means the enrollment is still active.
   */
  revokedAt: Date | null;

  /**
   * User who created the enrollment record.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the enrollment record.
   */
  updatedByUserId: string | null;
}

/**
 * Firestore document shape for persisted discussion MLS group state.
 */
export interface FirestoreDiscussionMlsGroupStateDocument {
  /**
   * Tenant namespace identifier scoping this group state row.
   */
  tenantId?: string;

  /**
   * Canonical MLS group id for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Entity type hosting the discussion thread.
   */
  targetEntityType: string;

  /**
   * Entity id hosting the discussion thread.
   */
  targetEntityId: string;

  /**
   * Latest MLS epoch observed for the thread.
   */
  currentEpoch: number;

  /**
   * When the group state row was created.
   */
  createdAt: Date;

  /**
   * When the group state row was last updated.
   */
  updatedAt: Date;

  /**
   * User who created the group state row.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the group state row.
   */
  updatedByUserId: string | null;
}

/**
 * Firestore document shape for persisted discussion MLS commits.
 */
export interface FirestoreDiscussionMlsCommitDocument {
  /**
   * Tenant namespace identifier scoping this commit row.
   */
  tenantId?: string;

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
   * When the commit was relayed through Team Hub.
   */
  createdAt: Date;

  /**
   * User who posted the commit relay record.
   */
  createdByUserId: string | null;
}

/**
 * Firestore document shape for persisted discussion MLS welcomes.
 */
export interface FirestoreDiscussionMlsWelcomeDocument {
  /**
   * Tenant namespace identifier scoping this welcome row.
   */
  tenantId?: string;

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
   * When the welcome was relayed through Team Hub.
   */
  createdAt: Date;

  /**
   * User who posted the welcome relay record.
   */
  createdByUserId: string | null;
}

/**
 * Firestore document shape for persisted collections.
 */
export interface FirestoreCollectionDocument {
  /**
   * Tenant namespace identifier scoping this collection.
   */
  tenantId?: string;

  /**
   * Display name for the collection.
   */
  name: string;

  /**
   * Collection-scoped variables.
   */
  variables: Variable[];

  /**
   * Default headers for requests in the collection.
   */
  headers: KeyValue[];

  /**
   * Default auth settings for requests in the collection.
   */
  auth: AuthConfig;

  /**
   * Pre-request script shared by all requests in the collection.
   */
  preRequestScript: string;

  /**
   * Post-request script shared by all requests in the collection.
   */
  postRequestScript: string;

  /**
   * When the collection was created.
   */
  createdAt: Date;

  /**
   * When the collection was last updated.
   */
  updatedAt: Date;

  /**
   * User who created the collection.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the collection.
   */
  updatedByUserId: string | null;

  /**
   * When true, non-admin users cannot delete this collection.
   */
  deletionLocked?: boolean;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker?: string | null;
}

/**
 * Firestore document shape for persisted environments.
 */
export interface FirestoreEnvironmentDocument {
  /**
   * Tenant namespace identifier scoping this environment.
   */
  tenantId?: string;

  /**
   * Display name for the environment.
   */
  name: string;

  /**
   * Environment-scoped variables.
   */
  variables: Variable[];

  /**
   * When the environment was created.
   */
  createdAt: Date;

  /**
   * When the environment was last updated.
   */
  updatedAt: Date;

  /**
   * User who created the environment.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the environment.
   */
  updatedByUserId: string | null;

  /**
   * When true, non-admin users cannot delete this environment.
   */
  deletionLocked?: boolean;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker?: string | null;

  /**
   * Parent environment id for inheritance, or null when a root.
   */
  parentUuid?: string | null;
}

/**
 * Firestore document shape for persisted snippets.
 */
export interface FirestoreSnippetDocument {
  /**
   * Tenant namespace identifier scoping this snippet.
   */
  tenantId?: string;

  /**
   * Display name for the snippet.
   */
  name: string;

  /**
   * JavaScript source inserted into requests.
   */
  code: string;

  /**
   * When the snippet may be applied relative to a request.
   */
  scope: 'pre-request' | 'post-request' | 'any';

  /**
   * Position for sidebar ordering.
   */
  sortOrder: number;

  /**
   * When the snippet was created.
   */
  createdAt: Date;

  /**
   * When the snippet was last updated.
   */
  updatedAt: Date;

  /**
   * User who created the snippet.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the snippet.
   */
  updatedByUserId: string | null;

  /**
   * When true, non-admin users cannot delete this snippet.
   */
  deletionLocked?: boolean;
}

/**
 * Firestore document shared by live servers and live pages.
 */
export interface FirestorePayloadEntityDocument {
  /**
   * Tenant namespace identifier scoping this entity.
   */
  tenantId?: string;

  name: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  deletionLocked?: boolean;
}

/**
 * Firestore document shape for persisted folders.
 */
export interface FirestoreFolderDocument {
  /**
   * Tenant namespace identifier scoping this folder.
   */
  tenantId?: string;

  /**
   * Parent collection identifier.
   */
  collectionId: string;

  /**
   * Parent folder identifier, or null at the collection root.
   */
  parentFolderId: string | null;

  /**
   * Display name for the folder.
   */
  name: string;

  /**
   * Position among sibling folders.
   */
  sortOrder: number;

  /**
   * When the folder was created.
   */
  createdAt: Date;

  /**
   * When the folder was last updated.
   */
  updatedAt: Date;

  /**
   * User who created the folder.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the folder.
   */
  updatedByUserId: string | null;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker?: string | null;
}

/**
 * Firestore document shape for persisted saved requests.
 */
export interface FirestoreRequestDocument {
  /**
   * Tenant namespace identifier scoping this request.
   */
  tenantId?: string;

  /**
   * Parent collection identifier.
   */
  collectionId: string;

  /**
   * Optional parent folder identifier.
   */
  folderId: string | null;

  /**
   * Display name for the request.
   */
  name: string;

  /**
   * HTTP method for the request.
   */
  method: string;

  /**
   * Transport protocol for the request (`http` or `sse`).
   */
  protocol?: string;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers.
   */
  headers: KeyValue[];

  /**
   * Query parameters.
   */
  params: KeyValue[];

  /**
   * Authorization settings.
   */
  auth: AuthConfig;

  /**
   * Request body content.
   */
  body: string;

  /**
   * Request body content type.
   */
  bodyType: string;

  /**
   * Pre-request script.
   */
  preRequestScript: string;

  /**
   * Post-request script.
   */
  postRequestScript: string;

  /**
   * Free-form notes.
   */
  comment: string;

  /**
   * Position within the collection or folder.
   */
  sortOrder: number;

  /**
   * When the request was created.
   */
  createdAt: Date;

  /**
   * When the request was last saved.
   */
  updatedAt: Date;

  /**
   * User who created the request.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the request.
   */
  updatedByUserId: string | null;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker?: string | null;
}

/**
 * Firestore document shape for persisted collection documents.
 */
export interface FirestoreDocumentDocument {
  /**
   * Tenant namespace identifier scoping this document.
   */
  tenantId?: string;

  /**
   * Parent collection identifier.
   */
  collectionId: string;

  /**
   * Optional parent folder identifier.
   */
  folderId: string | null;

  /**
   * Display file name for the document.
   */
  name: string;

  /**
   * Markdown body content.
   */
  content: string;

  /**
   * Position within the collection or folder.
   */
  sortOrder: number;

  /**
   * When the document was created.
   */
  createdAt: Date;

  /**
   * When the document was last saved.
   */
  updatedAt: Date;

  /**
   * User who created the document.
   */
  createdByUserId: string | null;

  /**
   * User who last updated the document.
   */
  updatedByUserId: string | null;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker?: string | null;
}
export interface FirestoreAuditLogDocument {
  /**
   * Tenant namespace identifier scoping this audit entry.
   */
  tenantId?: string;

  /**
   * Acting user identifier, when known.
   */
  userId: string | null;

  /**
   * Snapshot of the acting user's display name at write time.
   */
  userName: string | null;

  /**
   * CRUD or structural action performed.
   */
  action: AuditAction;

  /**
   * Entity kind affected by the action.
   */
  entityType: string;

  /**
   * Identifier of the affected entity.
   */
  entityId: string;

  /**
   * When the action was recorded.
   */
  createdAt: Date;

  /**
   * Optional structured context for the action.
   */
  metadata: Record<string, unknown> | null;
}

/**
 * Firestore document shape for persisted monthly LLM usage.
 */
export interface FirestoreLlmUsageDocument {
  /**
   * Tenant namespace identifier scoping this usage record.
   */
  tenantId?: string;

  /**
   * Owning user identifier.
   */
  userId: string;

  /**
   * UTC calendar month key (`YYYY-MM`).
   */
  period: string;

  /**
   * Prompt tokens consumed during the period.
   */
  promptTokens: number;

  /**
   * Completion tokens consumed during the period.
   */
  completionTokens: number;

  /**
   * Total tokens consumed during the period.
   */
  totalTokens: number;

  /**
   * When usage was last updated.
   */
  updatedAt: Date;
}

/**
 * Firestore document shape for per-request LLM usage log entries.
 */
export interface FirestoreLlmUsageLogDocument {
  /**
   * Tenant namespace identifier scoping this log entry.
   */
  tenantId?: string;

  /**
   * User who consumed tokens.
   */
  userId: string;

  /**
   * Bearer token used for the request, when known.
   */
  apiTokenId: string | null;

  /**
   * UTC calendar month key (`YYYY-MM`).
   */
  period: string;

  /**
   * Provider-specific model id sent to the API.
   */
  model: string;

  /**
   * LLM provider that served the request.
   */
  provider: string;

  /**
   * Prompt tokens billed for the step.
   */
  promptTokens: number;

  /**
   * Completion tokens billed for the step.
   */
  completionTokens: number;

  /**
   * Total tokens billed for the step.
   */
  totalTokens: number;

  /**
   * Whether the last message in the request was from the user.
   */
  isNewTurn: boolean;

  /**
   * Whether the model returned tool calls.
   */
  hadToolCalls: boolean;

  /**
   * Number of messages included in the request body.
   */
  messageCount: number;

  /**
   * When the completion step finished.
   */
  createdAt: Date;
}

/**
 * Firestore document shape for persisted run result snapshots.
 */
export interface FirestoreRunResultDocument {
  /**
   * Tenant namespace identifier scoping this run result.
   */
  tenantId?: string;

  /**
   * Whether the snapshot is a collection-wide or single-request run.
   */
  kind: RunResultKind;

  /**
   * User-facing label for list rows.
   */
  label: string;

  /**
   * Collection display name captured at save time.
   */
  collectionName: string | null;

  /**
   * Request display name when the run targeted one request.
   */
  requestName: string | null;

  /**
   * Pass/fail/skip counts derived from the saved result rows.
   */
  summary: RunResultSummaryCounts;

  /**
   * Complete HarborClient export payload stored as JSON.
   */
  payload: Record<string, unknown>;

  /**
   * When the run result was saved.
   */
  createdAt: Date;

  /**
   * User who saved the run result.
   */
  createdByUserId: string | null;
}

/**
 * Firestore document shape for persisted discussion comments.
 */
export interface FirestoreDiscussionCommentDocument {
  /**
   * Tenant namespace identifier scoping this comment.
   */
  tenantId?: string;

  /**
   * Kind of entity this comment is attached to.
   */
  targetEntityType: 'request' | 'collection' | 'folder' | 'runResult';

  /**
   * Identifier of the target entity.
   */
  targetEntityId: string;

  /**
   * Parent comment id, or null for depth-1 comments.
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

  /**
   * Comment body text.
   */
  body: string;

  /**
   * Body encoding format.
   */
  bodyFormat: 'plaintext' | 'encrypted';

  /**
   * Optional metadata for encrypted or enriched bodies.
   */
  bodyMetadata: Record<string, unknown> | null;

  /**
   * User who authored the comment.
   */
  authorUserId: string | null;

  /**
   * When the comment was created.
   */
  createdAt: Date;

  /**
   * When the comment was last updated.
   */
  updatedAt: Date;

  /**
   * When the comment was tombstoned, or null when active.
   */
  tombstonedAt: Date | null;

  /**
   * User who tombstoned the comment, when applicable.
   */
  tombstonedByUserId: string | null;
}

/**
 * Firestore document shape for collaboration notices.
 */
export interface FirestoreNoticeDocument {
  /**
   * Tenant namespace identifier scoping this notice.
   */
  tenantId?: string;

  /**
   * User who should receive the notice.
   */
  recipientUserId: string;

  /**
   * Event kind that created the notice.
   */
  eventType: string;

  /**
   * Primary entity type the notice deep-links to.
   */
  entityType: 'request' | 'collection' | 'folder' | 'runResult';

  /**
   * Primary entity identifier the notice deep-links to.
   */
  entityId: string;

  /**
   * Related request id, when applicable.
   */
  requestId: string | null;

  /**
   * Related collection id for access filtering, when applicable.
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
   * User who triggered the notice event.
   */
  actorUserId: string | null;

  /**
   * When the notice was created.
   */
  createdAt: Date;

  /**
   * When the recipient marked the notice read, or null while unread.
   */
  readAt: Date | null;

  /**
   * Denormalized labels for feed rendering.
   */
  displayMetadata: Record<string, unknown>;
}

/**
 * Firestore document shape for per-user notification settings.
 */
export interface FirestoreUserNotificationSettingsDocument {
  /**
   * Tenant namespace identifier scoping these settings.
   */
  tenantId?: string;

  /**
   * User account id the settings belong to.
   */
  userId: string;

  /**
   * Selected notification level controlling notice volume.
   */
  level: 'all' | 'mentions' | 'none';

  /**
   * When the settings were last updated.
   */
  updatedAt: Date;
}

/**
 * Firestore document shape for discussion thread subscriptions.
 */
export interface FirestoreDiscussionThreadSubscriptionDocument {
  /**
   * Tenant namespace identifier scoping this subscription.
   */
  tenantId?: string;

  /**
   * Subscribed user account id.
   */
  userId: string;

  /**
   * Root comment id identifying the watched thread.
   */
  rootCommentId: string;

  /**
   * When the subscription was created.
   */
  createdAt: Date;
}
