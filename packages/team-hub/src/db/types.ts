/**
 * Server account role controlling API and CLI capabilities.
 */
export type UserRole = 'admin' | 'user';

/**
 * CRUD or structural action recorded in the audit log.
 */
export type AuditAction = 'create' | 'update' | 'delete' | 'reorder' | 'move';

/**
 * Entity kinds tracked by the audit log.
 */
export type AuditEntityType =
  | 'tenant'
  | 'user'
  | 'api_token'
  | 'invitation'
  | 'collection'
  | 'environment'
  | 'snippet'
  | 'live_server'
  | 'live_page'
  | 'folder'
  | 'request'
  | 'document'
  | 'run_result'
  | 'discussion_comment'
  | 'device_key'
  | 'discussion_mls_group_state'
  | 'discussion_mls_commit'
  | 'discussion_mls_welcome';

/**
 * Persisted audit log entry describing a single mutating action.
 */
export interface AuditLogRecord {
  /**
   * Stable identifier for the audit entry.
   */
  id: string;

  /**
   * User who performed the action, when known.
   */
  userId: string | null;

  /**
   * Snapshot of the acting user's display name at write time.
   */
  userName: string | null;

  /**
   * Action that was performed.
   */
  action: AuditAction;

  /**
   * Kind of entity affected by the action.
   */
  entityType: AuditEntityType;

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
 * Optional filters when listing audit log entries.
 */
export interface ListAuditLogOptions {
  /**
   * Maximum number of entries to return, newest first.
   */
  limit?: number;

  /**
   * Restrict results to a specific acting user.
   */
  userId?: string;

  /**
   * Restrict results to a specific entity type.
   */
  entityType?: AuditEntityType;

  /**
   * Restrict results to a specific entity id.
   */
  entityId?: string;
}

/**
 * Stored metadata for a Team Hub tenant namespace.
 */
export interface TenantRecord {
  /**
   * Stable tenant identifier used in `X-Harbor-Tenant` and CLI flags.
   */
  id: string;

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
  avatarInitials: string | null;

  /**
   * Persisted hub avatar background color key (for example `sky-600`).
   */
  avatarColor: string | null;

  /**
   * Base64-encoded uploaded hub avatar image bytes, when present.
   *
   * Legacy/in-database storage. Prefer {@link avatarImageKey} when external
   * object storage is configured.
   */
  avatarImage: string | null;

  /**
   * Object-store key for the hub avatar when external storage is used.
   */
  avatarImageKey: string | null;

  /**
   * MIME type for {@link avatarImage} (for example `image/jpeg`).
   */
  avatarImageMime: string | null;

  /**
   * When the uploaded hub avatar image was last replaced, when present.
   */
  avatarImageUpdatedAt: Date | null;
}

/**
 * Optional uploaded hub avatar image fields for {@link IDatabase.updateTenantAvatar}.
 *
 * When omitted, existing image columns are left unchanged. Pass image fields
 * as `null` to clear a previously uploaded image.
 */
export interface TenantAvatarImageUpdate {
  /**
   * Base64-encoded image bytes, or null to clear / when using object storage.
   */
  imageBase64: string | null;

  /**
   * Object-store key for the image, or null when storing bytes in the database
   * or clearing the image.
   */
  imageKey: string | null;

  /**
   * Image MIME type, or null to clear.
   */
  mime: string | null;

  /**
   * Image replacement timestamp, or null to clear.
   */
  updatedAt: Date | null;
}

/**
 * Stored metadata for a Team Hub user account.
 */
export interface UserRecord {
  /**
   * Stable identifier used for token ownership and CLI operations.
   */
  id: string;

  /**
   * Unique display name chosen when the user was created.
   */
  name: string;

  /**
   * Role determining API capabilities: `user` for scoped entity access,
   * `admin` for management API access without entity access.
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
   * Live server ids the user may access, or `['*']` for all live servers.
   */
  liveServerAccess: string[];

  /**
   * Live page ids the user may access, or `['*']` for all live pages.
   */
  livePageAccess: string[];

  /**
   * When true, the user may call hub-proxied LLM routes.
   */
  llmAccess: boolean;

  /**
   * LLM model ids the user may use, or `['*']` for all hub-offered models.
   */
  llmModels: string[];

  /**
   * Maximum total tokens per UTC calendar month, or null for unlimited.
   */
  llmMonthlyTokenLimit: number | null;

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
   * Persisted avatar initials tile text, when assigned.
   */
  avatarInitials: string | null;

  /**
   * Persisted avatar background color key (for example `sky-600`).
   */
  avatarColor: string | null;

  /**
   * Base64-encoded uploaded avatar image bytes, when present.
   *
   * Legacy/in-database storage. Prefer {@link avatarImageKey} when external
   * object storage is configured.
   */
  avatarImage: string | null;

  /**
   * Object-store key for the user avatar when external storage is used.
   */
  avatarImageKey: string | null;

  /**
   * MIME type for {@link avatarImage} (for example `image/jpeg`).
   */
  avatarImageMime: string | null;

  /**
   * When the uploaded avatar image was last replaced, when present.
   */
  avatarImageUpdatedAt: Date | null;
}

/**
 * Fields required to create a new user account.
 */
export interface CreateUserInput {
  /**
   * Unique display name for the new account.
   */
  name: string;

  /**
   * Role assigned to the new account.
   */
  role: UserRole;

  /**
   * Collection access list; admins store an empty array.
   */
  collectionAccess: string[];

  /**
   * Environment access list; admins store an empty array.
   */
  environmentAccess: string[];

  /**
   * Snippet access list; admins store an empty array.
   */
  snippetAccess: string[];

  /**
   * Live server access list; admins store an empty array.
   */
  liveServerAccess: string[];

  /**
   * Live page access list; admins store an empty array.
   */
  livePageAccess: string[];

  /**
   * Whether the user may use hub-proxied LLM routes.
   */
  llmAccess?: boolean;

  /**
   * Allowed LLM model ids, or `['*']` for all hub-offered models.
   */
  llmModels?: string[];

  /**
   * Monthly token limit, or null for unlimited.
   */
  llmMonthlyTokenLimit?: number | null;

  /**
   * Optional avatar initials override; defaults are derived from the display name.
   */
  avatarInitials?: string;

  /**
   * Optional avatar color override; defaults are derived from the user id.
   */
  avatarColor?: string;
}

/**
 * Partial fields accepted when updating an existing user account.
 */
export interface UpdateUserInput {
  /**
   * New unique display name, when changing the account label.
   */
  name?: string;

  /**
   * New role, when changing account capabilities.
   */
  role?: UserRole;

  /**
   * Replacement collection access list.
   */
  collectionAccess?: string[];

  /**
   * Replacement environment access list.
   */
  environmentAccess?: string[];

  /**
   * Replacement snippet access list.
   */
  snippetAccess?: string[];

  /**
   * Replacement live server access list.
   */
  liveServerAccess?: string[];

  /**
   * Replacement live page access list.
   */
  livePageAccess?: string[];

  /**
   * Whether the user may use hub-proxied LLM routes.
   */
  llmAccess?: boolean;

  /**
   * Replacement LLM model access list.
   */
  llmModels?: string[];

  /**
   * Replacement monthly token limit, or null for unlimited.
   */
  llmMonthlyTokenLimit?: number | null;

  /**
   * Replacement avatar initials tile text.
   */
  avatarInitials?: string;

  /**
   * Replacement avatar background color key.
   */
  avatarColor?: string;

  /**
   * Replacement base64-encoded avatar image bytes, or null to clear.
   */
  avatarImage?: string | null;

  /**
   * Replacement object-store key for the avatar image, or null when clearing
   * or storing bytes in the database.
   */
  avatarImageKey?: string | null;

  /**
   * Replacement MIME type for {@link avatarImage}, or null when clearing.
   */
  avatarImageMime?: string | null;

  /**
   * Replacement timestamp for the uploaded avatar image, or null when clearing.
   */
  avatarImageUpdatedAt?: Date | null;
}

/**
 * Stored metadata for a database-backed API bearer token.
 *
 * The raw secret is never persisted; only its sha256 hash is stored for lookup.
 */
export interface ApiTokenRecord {
  /**
   * Stable identifier used for revoke and audit operations.
   */
  id: string;

  /**
   * Owning user account that receives the token's access permissions.
   */
  userId: string;

  /**
   * Human-readable label chosen when the token was created.
   */
  name: string;

  /**
   * sha256 hex digest of the bearer token secret.
   */
  tokenHash: string;

  /**
   * Non-secret prefix shown in listings (for example `hbk_AbCd1234`).
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
 * Public key material format stored for an enrolled Team Hub device.
 */
export type DeviceKeyFormat = 'identity-v1' | 'mls-key-package';

/**
 * Stored metadata for a client device enrolled for E2EE discussion access.
 *
 * Private key material never enters the server; only public payloads are persisted.
 */
export interface DeviceKeyRecord {
  /**
   * Stable identifier used for revoke and audit operations.
   */
  id: string;

  /**
   * Owning user account for this device enrollment.
   */
  userId: string;

  /**
   * Client-generated stable device identifier scoped per user and hub.
   */
  deviceId: string;

  /**
   * Human-readable label chosen during enrollment.
   */
  label: string;

  /**
   * Format of {@link publicKeyMaterial} for future MLS KeyPackage support.
   */
  keyFormat: DeviceKeyFormat;

  /**
   * Base64-encoded public key material or MLS KeyPackage bytes.
   */
  publicKeyMaterial: string;

  /**
   * sha256 hex digest of {@link publicKeyMaterial} for lookup and display.
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
 * Stored MLS group state for a discussion thread on an E2EE hub.
 */
export interface DiscussionMlsGroupStateRecord {
  /**
   * Canonical MLS group id for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Entity type hosting the discussion thread.
   */
  targetEntityType: DiscussionTargetEntityType;

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
 * Persisted MLS commit relayed to existing group members.
 */
export interface DiscussionMlsCommitRecord {
  /**
   * Stable commit record identifier referenced by discussion comment metadata.
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
   * When the commit was relayed through Team Hub.
   */
  createdAt: Date;

  /**
   * User who posted the commit relay record.
   */
  createdByUserId: string | null;
}

/**
 * Persisted MLS welcome delivered to a newly added device.
 */
export interface DiscussionMlsWelcomeRecord {
  /**
   * Stable welcome record identifier referenced by discussion comment metadata.
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
   * When the welcome was relayed through Team Hub.
   */
  createdAt: Date;

  /**
   * User who posted the welcome relay record.
   */
  createdByUserId: string | null;
}

/**
 * Input for posting an MLS commit relay record.
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
 * Input for posting an MLS welcome relay record.
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
 * Input for upserting discussion MLS group state after a commit.
 */
export interface UpsertDiscussionMlsGroupStateInput {
  /**
   * MLS group identifier for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Latest MLS epoch observed for the thread.
   */
  currentEpoch: number;
}

/**
 * Query options for listing MLS commits on a discussion thread.
 */
export interface ListDiscussionMlsCommitsOptions {
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
export interface ListDiscussionMlsCommitsResult {
  /**
   * Commits in ascending epoch order for the requested page.
   */
  commits: DiscussionMlsCommitRecord[];

  /**
   * Opaque cursor for the next page, when more commits exist.
   */
  nextCursor?: string;
}

/**
 * Query options for listing MLS welcomes on a discussion thread.
 */
export interface ListDiscussionMlsWelcomesOptions {
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
export interface ListDiscussionMlsWelcomesResult {
  /**
   * Welcome records in creation order for the requested page.
   */
  welcomes: DiscussionMlsWelcomeRecord[];
}

/**
 * Input for enrolling a new device key on an E2EE-enabled Team Hub.
 */
export interface CreateDeviceKeyInput {
  /**
   * Owning user account receiving the enrollment.
   */
  userId: string;

  /**
   * Client-generated stable device identifier.
   */
  deviceId: string;

  /**
   * Human-readable label for operator listings.
   */
  label: string;

  /**
   * Format of {@link publicKeyMaterial}.
   */
  keyFormat?: DeviceKeyFormat;

  /**
   * Base64-encoded public key material uploaded by the client.
   */
  publicKeyMaterial: string;
}

/**
 * Stored metadata for a single-use user onboarding invitation.
 *
 * The raw invitation secret is never persisted; only its sha256 hash is stored.
 */
export interface InvitationRecord {
  /**
   * Stable identifier used for admin listing and revocation.
   */
  id: string;

  /**
   * User account that receives an API token when the invitation is redeemed.
   */
  userId: string;

  /**
   * sha256 hex digest of the invitation secret.
   */
  codeHash: string;

  /**
   * Non-secret prefix shown in listings (for example `hbi_AbCd1234`).
   */
  codePrefix: string;

  /**
   * When the invitation stops being redeemable.
   */
  expiresAt: Date;

  /**
   * When the invitation was redeemed; null means it is still pending or revoked.
   */
  redeemedAt: Date | null;

  /**
   * When the invitation was revoked by an operator; null means not revoked.
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
 * Fields required to create a user account together with an initial invitation.
 */
export interface CreateInvitedUserInput extends CreateUserInput {
  /**
   * Optional invitation lifetime in hours; defaults to 24 when omitted.
   */
  expiresInHours?: number;
}

/**
 * Fields required to issue a replacement invitation for an existing user.
 */
export interface CreateUserInvitationInput {
  /**
   * Existing user account that will receive access after redemption.
   */
  userId: string;

  /**
   * Optional invitation lifetime in hours; defaults to 24 when omitted.
   */
  expiresInHours?: number;
}

/**
 * Result of atomically creating a user account and its initial invitation.
 */
export interface CreatedInvitedUserResult {
  /**
   * Newly created user account without any API tokens yet.
   */
  user: UserRecord;

  /**
   * Persisted invitation metadata (secret hash only).
   */
  invitation: InvitationRecord;
}

/**
 * Result of redeeming a pending invitation into a permanent API token.
 */
export interface RedeemedInvitationResult {
  /**
   * User account that now owns the issued API token.
   */
  user: UserRecord;

  /**
   * Newly created permanent API token metadata.
   */
  token: ApiTokenRecord;

  /**
   * One-time plaintext bearer secret for HarborClient storage.
   */
  secret: string;
}

/**
 * Persisted monthly LLM token usage for a user.
 */
export interface LlmUsageRecord {
  /**
   * Stable identifier for the usage row.
   */
  id: string;

  /**
   * Owning user account id.
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
 * LLM provider id stored on per-request usage log rows.
 */
export type LlmUsageLogProvider = 'openai' | 'claude' | 'gemini';

/**
 * Persisted per-request LLM usage log entry.
 */
export interface LlmUsageLogRecord {
  /**
   * Stable identifier for the log row.
   */
  id: string;

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
  provider: LlmUsageLogProvider;

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
 * Input for inserting a per-request LLM usage log row.
 */
export interface CreateLlmUsageLogInput {
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
  provider: LlmUsageLogProvider;

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
}

/**
 * Supported HTTP request methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Transport protocol for a saved request (`http` or `sse`).
 */
export type RequestProtocol = 'http' | 'sse';

/**
 * Request body content type.
 */
export type BodyType = 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';

/**
 * Authorization type for saved requests and collections.
 */
export type AuthType = 'none' | 'basic' | 'bearer';

/**
 * Basic and bearer credential fields stored together so switching type preserves values.
 */
export interface AuthConfig {
  /**
   * Selected auth mode; none means no request-level override.
   */
  type: AuthType;

  /**
   * Username and password for Basic Auth.
   */
  basic: {
    username: string;
    password: string;
  };

  /**
   * Token value for Bearer Token auth.
   */
  bearer: {
    token: string;
  };
}

/**
 * A key-value pair with an enable toggle for headers and query params.
 */
export interface KeyValue {
  /**
   * Header or query parameter name.
   */
  key: string;

  /**
   * Header or query parameter value.
   */
  value: string;

  /**
   * When false, the pair is ignored when building the request.
   */
  enabled: boolean;
}

/**
 * A collection-scoped or environment-scoped variable for {{key}} substitution.
 */
export interface Variable {
  /**
   * Variable name referenced in {{key}} placeholders.
   */
  key: string;

  /**
   * Value substituted when the variable is resolved.
   */
  value: string;

  /**
   * Fallback value used when value is empty.
   */
  defaultValue: string;

  /**
   * When false, the row is ignored at resolve time so a parent/lower scope can pass through.
   */
  enabled: boolean;

  /**
   * When true, value is included in collection exports.
   */
  share: boolean;
}

/**
 * Persisted collection metadata and defaults shared by all requests in the collection.
 */
export interface CollectionRecord {
  /**
   * Stable collection identifier.
   */
  id: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Collection-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];

  /**
   * Headers sent with every request in this collection.
   */
  headers: KeyValue[];

  /**
   * Default Authorization settings inherited by requests unless overridden.
   */
  auth: AuthConfig;

  /**
   * JavaScript run before every request in this collection.
   */
  preRequestScript: string;

  /**
   * JavaScript run after every request in this collection.
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
  deletionLocked: boolean;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker: string | null;
}

/**
 * Persisted environment with scoped variables.
 */
export interface EnvironmentRecord {
  /**
   * Stable environment identifier.
   */
  id: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Environment-scoped variables for {{key}} substitution in requests.
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
  deletionLocked: boolean;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker: string | null;

  /**
   * Portable uuid of the parent environment this one inherits from, or null when a root.
   */
  parentUuid: string | null;
}

/**
 * Execution scope for a reusable code snippet.
 */
export type SnippetScope = 'pre-request' | 'post-request' | 'any';

/**
 * Persisted reusable script snippet.
 */
export interface SnippetRecord {
  /**
   * Stable snippet identifier.
   */
  id: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * JavaScript source inserted into requests.
   */
  code: string;

  /**
   * When the snippet may be applied relative to a request.
   */
  scope: SnippetScope;

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
  deletionLocked: boolean;
}

/**
 * Shared persisted shape for provider-routed entities whose configuration is
 * stored as one JSON payload.
 */
export interface PayloadEntityRecord {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  deletionLocked: boolean;
}

/**
 * Persisted live server configuration.
 */
export type LiveServerRecord = PayloadEntityRecord;

/**
 * Persisted live page (Website) configuration.
 */
export type LivePageRecord = PayloadEntityRecord;

/**
 * Input used to create a live server on Team Hub.
 */
export interface CreateLiveServerRecordInput {
  name: string;
  payload: Record<string, unknown>;
}

/**
 * Input used to replace a live server on Team Hub.
 */
export type UpdateLiveServerRecordInput = CreateLiveServerRecordInput;

/**
 * Input used to create a live page on Team Hub.
 */
export interface CreateLivePageRecordInput {
  name: string;
  payload: Record<string, unknown>;
}

/**
 * Input used to replace a live page on Team Hub.
 */
export type UpdateLivePageRecordInput = CreateLivePageRecordInput;

/**
 * Discriminator for collection-wide or single-request run result snapshots.
 */
export type RunResultKind = 'collection-run-results' | 'request-run-results';

/**
 * Pass/fail/skip counts stored with a run result snapshot.
 */
export interface RunResultSummaryCounts {
  /**
   * Number of requests that passed.
   */
  passed: number;

  /**
   * Number of requests that failed.
   */
  failed: number;

  /**
   * Number of requests that were skipped.
   */
  skipped: number;
}

/**
 * Persisted collection runner result snapshot.
 */
export interface RunResultRecord {
  /**
   * Stable run result identifier.
   */
  id: string;

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
 * Input for creating a run result snapshot.
 */
export interface CreateRunResultInput {
  /**
   * Optional display label; generated from payload metadata when omitted.
   */
  label?: string;

  /**
   * HarborClient run-results export payload to persist.
   */
  payload: Record<string, unknown>;
}

/**
 * A folder for organizing requests within a collection.
 */
export interface FolderRecord {
  /**
   * Stable folder identifier.
   */
  id: string;

  /**
   * ID of the collection this folder belongs to.
   */
  collectionId: string;

  /**
   * Parent folder identifier, or null at the collection root.
   */
  parentFolderId: string | null;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Position among sibling folders for sidebar ordering.
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
  marker: string | null;
}

/**
 * A saved HTTP request belonging to a collection.
 */
export interface SavedRequestRecord {
  /**
   * Stable request identifier.
   */
  id: string;

  /**
   * ID of the collection this request belongs to.
   */
  collectionId: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Transport protocol for this request (`http` or `sse`).
   */
  protocol: RequestProtocol;

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Authorization settings; none inherits collection auth at send time.
   */
  auth: AuthConfig;

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  bodyType: BodyType;

  /**
   * JavaScript run before the request is sent.
   */
  preRequestScript: string;

  /**
   * JavaScript run after the response is received.
   */
  postRequestScript: string;

  /**
   * Free-form notes for this request.
   */
  comment: string;

  /**
   * ID of the folder containing this request, or null when at collection root.
   */
  folderId: string | null;

  /**
   * Position within the collection for sidebar ordering.
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
  marker: string | null;
}

/**
 * Input for creating or updating a saved request.
 */
export interface SaveRequestInput {
  /**
   * Existing request ID; omit to insert a new request.
   */
  id?: string;

  /**
   * ID of the collection to save the request in.
   */
  collectionId: string;

  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * Transport protocol for this request (`http` or `sse`).
   */
  protocol?: RequestProtocol;

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Authorization settings; none inherits collection auth at send time.
   */
  auth: AuthConfig;

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  bodyType: BodyType;

  /**
   * JavaScript run before the request is sent.
   */
  preRequestScript: string;

  /**
   * JavaScript run after the response is received.
   */
  postRequestScript: string;

  /**
   * Free-form notes for this request.
   */
  comment: string;

  /**
   * ID of the folder containing this request, or null when at collection root.
   */
  folderId?: string | null;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker?: string | null;
}

/**
 * A markdown document attached to a collection or folder.
 */
export interface DocumentRecord {
  /**
   * Stable document identifier.
   */
  id: string;

  /**
   * ID of the collection this document belongs to.
   */
  collectionId: string;

  /**
   * ID of the folder containing this document, or null when at collection root.
   */
  folderId: string | null;

  /**
   * Display file name shown in the sidebar (for example README.md).
   */
  name: string;

  /**
   * Markdown body content.
   */
  content: string;

  /**
   * Position within the collection or folder for sidebar ordering.
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
  marker: string | null;
}

/**
 * Input for creating or updating a collection document.
 */
export interface SaveDocumentInput {
  /**
   * Existing document ID; omit to insert a new document.
   */
  id?: string;

  /**
   * ID of the collection to save the document in.
   */
  collectionId: string;

  /**
   * Display file name for the document.
   */
  name: string;

  /**
   * Markdown body content.
   */
  content: string;

  /**
   * ID of the folder containing this document, or null when at collection root.
   */
  folderId?: string | null;

  /**
   * Optional sidebar marker (CSS color string) for visual grouping.
   */
  marker?: string | null;
}

/**
 * Entity kinds that can host Team Hub discussion threads.
 */
export type DiscussionTargetEntityType = 'request' | 'collection' | 'folder' | 'runResult';

/**
 * Stored format for a discussion comment body.
 */
export type DiscussionBodyFormat = 'plaintext' | 'encrypted';

/**
 * Persisted Team Hub discussion comment with tree metadata.
 */
export interface DiscussionCommentRecord {
  /**
   * Stable comment identifier.
   */
  id: string;

  /**
   * Kind of entity this comment is attached to.
   */
  targetEntityType: DiscussionTargetEntityType;

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
   * Comment body text; empty when tombstoned for normal clients.
   */
  body: string;

  /**
   * Body encoding format to support future encrypted payloads.
   */
  bodyFormat: DiscussionBodyFormat;

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
 * Input for creating a discussion comment on a target entity.
 */
export interface CreateDiscussionCommentInput {
  /**
   * Entity type hosting the discussion thread.
   */
  targetEntityType: DiscussionTargetEntityType;

  /**
   * Entity identifier hosting the discussion thread.
   */
  targetEntityId: string;

  /**
   * Plaintext comment body.
   */
  body: string;

  /**
   * Parent comment id when creating a reply; omit for top-level comments.
   */
  parentCommentId?: string | null;

  /**
   * Body format; defaults to plaintext.
   */
  bodyFormat?: DiscussionBodyFormat;

  /**
   * Optional metadata for encrypted or enriched bodies.
   */
  bodyMetadata?: Record<string, unknown> | null;
}

/**
 * Input for updating a discussion comment body.
 */
export interface UpdateDiscussionCommentInput {
  /**
   * Replacement body text or ciphertext.
   */
  body: string;

  /**
   * Body format; defaults to plaintext.
   */
  bodyFormat?: DiscussionBodyFormat;

  /**
   * Optional metadata for encrypted or enriched bodies.
   */
  bodyMetadata?: Record<string, unknown> | null;
}

/**
 * Options when listing discussion comments for a target entity.
 */
export interface ListDiscussionCommentsOptions {
  /**
   * Entity type whose comments should be listed.
   */
  targetEntityType: DiscussionTargetEntityType;

  /**
   * Entity id whose comments should be listed.
   */
  targetEntityId: string;

  /**
   * ISO timestamp cursor; returns comments created strictly after this instant.
   */
  cursor?: string;

  /**
   * Maximum number of comments to return (default 50, max 100).
   */
  limit?: number;
}

/**
 * Paginated list result for discussion comments on one target entity.
 */
export interface ListDiscussionCommentsResult {
  /**
   * Comments ordered oldest-first within the requested page.
   */
  comments: DiscussionCommentRecord[];

  /**
   * Cursor for the next page, or null when no further comments exist.
   */
  nextCursor: string | null;
}

/**
 * Collaboration notice event kinds materialized for the notices feed.
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
export type NoticeEntityType = 'request' | 'collection' | 'folder' | 'runResult';

/**
 * Short display metadata denormalized onto notice rows for list rendering.
 */
export interface NoticeDisplayMetadata {
  /**
   * Display name of the user who triggered the notice event.
   */
  actorName: string;

  /**
   * Human-readable label for the target entity (request name, folder name, etc.).
   */
  targetLabel: string;

  /**
   * HTTP method for request-scoped notices, when applicable.
   */
  method?: string;

  /**
   * Request display name when distinct from {@link targetLabel}.
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
 * Persisted collaboration notice scoped to one recipient user.
 */
export interface NoticeRecord {
  /**
   * Stable notice identifier.
   */
  id: string;

  /**
   * User who should receive the notice.
   */
  recipientUserId: string;

  /**
   * Event kind that created the notice.
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
   * Related request id, when the notice targets or references a request.
   */
  requestId: string | null;

  /**
   * Related collection id used for access filtering and navigation.
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
   * Root discussion thread id (`rootCommentId`), when applicable.
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
   * Denormalized labels for feed rendering without extra entity lookups.
   */
  displayMetadata: NoticeDisplayMetadata;
}

/**
 * Input for creating a collaboration notice row.
 */
export interface CreateNoticeInput {
  /**
   * User who should receive the notice.
   */
  recipientUserId: string;

  /**
   * Event kind that created the notice.
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
  requestId?: string | null;

  /**
   * Related collection id for access filtering, when applicable.
   */
  collectionId?: string | null;

  /**
   * Related folder id, when applicable.
   */
  folderId?: string | null;

  /**
   * Related run result id, when applicable.
   */
  runResultId?: string | null;

  /**
   * Root discussion thread id, when applicable.
   */
  discussionThreadId?: string | null;

  /**
   * Discussion comment id that triggered the notice, when applicable.
   */
  discussionCommentId?: string | null;

  /**
   * User who triggered the notice event.
   */
  actorUserId: string;

  /**
   * Denormalized labels for feed rendering.
   */
  displayMetadata: NoticeDisplayMetadata;
}

/**
 * Options when listing notices for the authenticated recipient.
 */
export interface ListNoticesOptions {
  /**
   * Recipient user id (always the authenticated user for API routes).
   */
  recipientUserId: string;

  /**
   * ISO timestamp cursor from a prior list response.
   */
  cursor?: string;

  /**
   * Maximum number of notices to return (default 50, max 100).
   */
  limit?: number;
}

/**
 * Paginated list result for a recipient's notices feed.
 */
export interface ListNoticesResult {
  /**
   * Notices ordered newest-first within the requested page.
   */
  notices: NoticeRecord[];

  /**
   * Cursor for the next page, or null when no further notices exist.
   */
  nextCursor: string | null;
}

/**
 * Per-user collaboration notification preference level.
 */
export type NotificationLevel = 'all' | 'mentions' | 'none';

/**
 * Persisted notification settings for one user account.
 */
export interface UserNotificationSettingsRecord {
  /**
   * User account id the settings belong to.
   */
  userId: string;

  /**
   * Selected notification level controlling notice volume.
   */
  level: NotificationLevel;

  /**
   * When the settings were last updated.
   */
  updatedAt: Date;
}

/**
 * Persisted thread watch state for discussion notifications.
 */
export interface DiscussionThreadSubscriptionRecord {
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

/**
 * Returns a default auth config with type none and empty credentials.
 *
 * @returns Empty AuthConfig safe for new requests and collections.
 */
export function defaultAuth(): AuthConfig {
  return {
    type: 'none',
    basic: { username: '', password: '' },
    bearer: { token: '' }
  };
}

/**
 * JSON string of {@link defaultAuth} for database column defaults.
 */
export const DEFAULT_AUTH_JSON = JSON.stringify(defaultAuth());

/**
 * Normalizes a partial or legacy auth value from storage into a full AuthConfig.
 *
 * @param value - Parsed JSON or unknown field from the database.
 * @returns Valid AuthConfig with defaults for missing fields.
 */
export function normalizeAuth(value: unknown): AuthConfig {
  const fallback = defaultAuth();
  if (value == null || typeof value !== 'object') {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const type =
    record.type === 'basic' || record.type === 'bearer' || record.type === 'none'
      ? record.type
      : fallback.type;

  const basicRecord =
    record.basic != null && typeof record.basic === 'object'
      ? (record.basic as Record<string, unknown>)
      : {};
  const bearerRecord =
    record.bearer != null && typeof record.bearer === 'object'
      ? (record.bearer as Record<string, unknown>)
      : {};

  return {
    type,
    basic: {
      username: typeof basicRecord.username === 'string' ? basicRecord.username : '',
      password: typeof basicRecord.password === 'string' ? basicRecord.password : ''
    },
    bearer: {
      token: typeof bearerRecord.token === 'string' ? bearerRecord.token : ''
    }
  };
}

/**
 * Normalizes a variable row from storage.
 *
 * @param value - Partial variable from JSON.
 * @returns Variable with defaults for missing fields.
 */
export function normalizeVariable(value: Partial<Variable>): Variable {
  return {
    key: typeof value.key === 'string' ? value.key : '',
    value: typeof value.value === 'string' ? value.value : '',
    defaultValue: typeof value.defaultValue === 'string' ? value.defaultValue : '',
    /**
     * Legacy rows without `enabled` remain active so existing data keeps working.
     */
    enabled: value.enabled !== false,
    share: typeof value.share === 'boolean' ? value.share : false
  };
}
