import type { HubLlmModel } from './ai';
import type { CollectionRunnerSummary, RunResultsExportKind } from '../collectionRunner';
import type { HttpMethod, RequestProtocol } from './common';
import type { SnippetScope } from '../snippetScope';

/**
 * Hub avatar presentation returned by Team Hub session introspection.
 */
export interface TeamHubAvatar {
  /**
   * Human-readable hub/tenant display name from the server.
   */
  name: string;

  /**
   * One or two uppercase initials shown in the avatar tile.
   */
  initials: string;

  /**
   * Persisted palette color key (for example `sky-600`).
   */
  color: string;

  /**
   * Relative URL for the uploaded hub avatar image when present.
   */
  imageUrl?: string;
}

/**
 * Request body for updating a Team Hub server avatar (admin).
 */
export interface UpdateHubAvatarInput {
  /**
   * Replacement initials tile text.
   */
  initials?: string;

  /**
   * Replacement palette color key.
   */
  color?: string;

  /**
   * Cropped hub avatar image as a data URL (`data:image/…;base64,…`).
   *
   * Pass `null` to clear a previously uploaded image.
   */
  imageDataUrl?: string | null;
}

/**
 * Response body from updating a Team Hub server avatar.
 */
export interface UpdateHubAvatarResponse {
  /**
   * Human-readable hub/tenant display name from the server.
   */
  name: string;

  /**
   * Persisted avatar initials tile text.
   */
  initials: string;

  /**
   * Persisted avatar background color key.
   */
  color: string;

  /**
   * Relative URL for the uploaded hub avatar image when present.
   */
  imageUrl?: string;
}

/**
 * Request body for updating the authenticated user's Team Hub avatar.
 */
export interface UpdateMyAvatarInput {
  /**
   * Replacement initials tile text.
   */
  initials?: string;

  /**
   * Replacement palette color key.
   */
  color?: string;

  /**
   * Cropped avatar image as a data URL (`data:image/…;base64,…`).
   *
   * Pass `null` to clear a previously uploaded image.
   */
  imageDataUrl?: string | null;
}

/**
 * Response body from updating the authenticated user's Team Hub avatar.
 */
export interface UpdateMyAvatarResponse {
  /**
   * Persisted avatar initials tile text.
   */
  avatarInitials: string;

  /**
   * Persisted avatar background color key.
   */
  avatarColor: string;

  /**
   * Relative URL for the uploaded avatar image when present.
   */
  avatarImageUrl?: string;
}

/**
 * Binary avatar image returned by Team Hub avatar download routes.
 */
export interface UserAvatarImage {
  /**
   * Image MIME type (for example `image/jpeg`).
   */
  mime: string;

  /**
   * Raw image bytes.
   */
  bytes: Uint8Array;

  /**
   * Data URL suitable for renderer `<img src>` usage.
   */
  dataUrl: string;
}

/**
 * A configured HarborClient Team Hub connection.
 */
export interface TeamHub {
  /**
   * Unique team hub identifier.
   */
  id: string;

  /**
   * User-defined display name.
   */
  name: string;

  /**
   * HarborClient Team Hub base URL (for example `http://127.0.0.1:8788`).
   */
  baseUrl: string;

  /**
   * Bearer token prefixed with `hbk_` for protected routes.
   */
  token: string;

  /**
   * Tenant identifier for multitenancy mode.
   *
   * When omitted or empty, requests route to the default tenant. The client
   * trims whitespace and normalizes blank strings to undefined.
   */
  tenantId?: string;

  /**
   * When false, the hub is soft-disconnected: config and token remain but the
   * storage backend is unmounted. Omitted or true means connected. Populated
   * by the main process when listing hubs; not persisted on save.
   */
  connected?: boolean;

  /**
   * Last known authenticated user display name from session introspection.
   * Used for avatar initials. Populated by the main process when listing hubs;
   * not persisted on save.
   */
  userName?: string;
}

/**
 * One plugin source URL provided by a connected Team Hub.
 */
export interface TeamHubPluginSource {
  /**
   * Team hub connection identifier from local settings.
   */
  hubId: string;

  /**
   * User-defined Team Hub display name.
   */
  hubName: string;

  /**
   * Catalog or trusted registry endpoint URL from the Team Hub.
   */
  url: string;
}

/**
 * Read-only Team Hub plugin sources returned to the renderer.
 */
export interface TeamHubPluginSourcesView {
  /**
   * Catalog endpoint URLs from connected Team Hubs.
   */
  catalogs: TeamHubPluginSource[];

  /**
   * Trusted publisher registry URLs from connected Team Hubs.
   */
  trusted: TeamHubPluginSource[];
}

/**
 * Hub server services discovered during a team hub scan.
 */
export interface TeamHubServiceFlags {
  /**
   * When true, the hub server exposes collection storage routes.
   */
  storage: boolean;

  /**
   * When true, the hub server has LLM proxy support configured.
   */
  llm: boolean;

  /**
   * When true, the hub provides OpenAI-backed services (embeddings, OpenAI models, docs search).
   */
  openai: boolean;

  /**
   * When true, the hub server publishes plugin catalog or trusted URLs.
   */
  pluginCatalog: boolean;

  /**
   * When true, the hub server exposes snippet storage routes.
   */
  snippets: boolean;

  /**
   * When true, the hub server exposes live-server storage routes.
   */
  liveServers?: boolean;

  /**
   * When true, the hub server exposes live-page storage routes.
   */
  livePages?: boolean;

  /**
   * When true, this connection uses an admin token with management API access.
   */
  admin: boolean;

  /**
   * When true, the hub server exposes discussion/communication routes.
   */
  communication?: boolean;
}

/**
 * Result of probing a team hub connection for server services and token capabilities.
 */
export interface TeamHubSessionScanResult {
  /**
   * Team hub connection id that was scanned.
   */
  hubId: string;

  /**
   * Hub server services discovered for this connection.
   */
  services: TeamHubServiceFlags;

  /**
   * When true, the hub token has management API capabilities.
   */
  managementApi: boolean;

  /**
   * Authenticated session user when the probe succeeded.
   */
  user?: {
    /**
     * Stable user account identifier.
     */
    id: string;

    /**
     * Display name for the authenticated account.
     */
    name: string;

    /**
     * Account role determining API capabilities.
     */
    role: 'admin' | 'user';

    /**
     * Persisted avatar initials tile text when the hub supports user avatars.
     */
    avatarInitials?: string;

    /**
     * Persisted avatar background color key when the hub supports user avatars.
     */
    avatarColor?: string;

    /**
     * Relative URL for the user's uploaded avatar image when present.
     */
    avatarImageUrl?: string;
  };

  /**
   * Human-readable error when the scan failed; omitted on success.
   */
  error?: string;

  /**
   * When true, the authenticated token may call discussion routes on this hub.
   *
   * Derived from session capabilities during {@link scanTeamHubSessions}.
   */
  communicationAccess?: boolean;

  /**
   * When true, the hub requires encrypted discussion comment bodies.
   *
   * Derived from session capabilities during {@link scanTeamHubSessions}.
   */
  discussionE2ee?: boolean;

  /**
   * When true, this device has active local keys and a matching server enrollment.
   *
   * Derived during {@link scanTeamHubSessions} on E2EE hubs.
   */
  deviceEnrolled?: boolean;

  /**
   * Server-provided hub avatar metadata when the probe succeeded on a hub that
   * exposes avatar fields in session responses.
   */
  hubAvatar?: TeamHubAvatar;
}

/**
 * Team Hub user account returned by management routes.
 */
export interface HubUserRecord {
  /**
   * Stable user account identifier.
   */
  id: string;

  /**
   * Unique display name for the account.
   */
  name: string;

  /**
   * Account role determining API capabilities.
   */
  role: 'admin' | 'user';

  /**
   * Persisted avatar initials tile text.
   */
  avatarInitials: string;

  /**
   * Persisted avatar background color key.
   */
  avatarColor: string;

  /**
   * Relative URL for the user's uploaded avatar image when present.
   */
  avatarImageUrl?: string;

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
   * ISO 8601 timestamp when the account was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the account was last updated.
   */
  updatedAt: string;
}

/**
 * Lightweight id/name record returned by admin list routes for autocomplete.
 */
export interface AdminResourceOption {
  /**
   * Stable resource identifier stored in access lists.
   */
  id: string;

  /**
   * Human-readable label shown in autocomplete suggestions.
   */
  name: string;

  /**
   * When true, non-admin users cannot delete this resource on the hub.
   */
  deletionLocked: boolean;
}

/**
 * Admin configuration returned by entity configuration routes.
 */
export interface AdminEntityConfig {
  /**
   * Stable resource identifier.
   */
  id: string;

  /**
   * Human-readable label.
   */
  name: string;

  /**
   * When true, non-admin users cannot delete this resource on the hub.
   */
  deletionLocked: boolean;
}

/**
 * Collection, environment, and LLM model options for admin user management forms.
 */
export interface TeamHubAdminResourceOptions {
  /**
   * All hub collections available when assigning collection access.
   */
  collections: AdminResourceOption[];

  /**
   * All hub environments available when assigning environment access.
   */
  environments: AdminResourceOption[];

  /**
   * All hub-offered LLM models available when assigning model access.
   */
  models: HubLlmModel[];
}

/**
 * Folder metadata returned by admin collection inspection routes.
 */
export interface TeamHubAdminFolderSummary {
  /**
   * Folder UUID.
   */
  id: string;

  /**
   * Display name shown in the collection tree.
   */
  name: string;

  /**
   * Parent folder UUID, or null when the folder is at the collection root.
   */
  parentFolderId: string | null;

  /**
   * Zero-based sort order among siblings that share the same parent.
   */
  sortOrder: number;
}

/**
 * Saved request metadata returned by admin collection inspection routes.
 */
export interface TeamHubAdminRequestSummary {
  /**
   * Saved request UUID.
   */
  id: string;

  /**
   * Display name shown in the collection tree.
   */
  name: string;

  /**
   * Transport protocol for the saved request (`http` or `sse`).
   */
  protocol: RequestProtocol;

  /**
   * HTTP method for the saved request.
   */
  method: HttpMethod;

  /**
   * Request URL template or absolute URL.
   */
  url: string;

  /**
   * Parent folder UUID, or null when at the collection root.
   */
  folderId: string | null;

  /**
   * Zero-based sort order within the folder or collection root.
   */
  sortOrder: number;
}

/**
 * Folders and requests in a hub collection for admin inspection.
 */
export interface TeamHubAdminCollectionContents {
  /**
   * Folders in the collection ordered by sort order.
   */
  folders: TeamHubAdminFolderSummary[];

  /**
   * Saved requests in the collection.
   */
  requests: TeamHubAdminRequestSummary[];
}

/**
 * Snippet record returned by Team Hub admin snippet management routes.
 */
export interface TeamHubAdminSnippet {
  /**
   * Snippet UUID on the hub server.
   */
  id: string;

  /**
   * Display name shown in snippet pickers.
   */
  name: string;

  /**
   * JavaScript source executed when the snippet is referenced.
   */
  code: string;

  /**
   * Script phases where the snippet may be referenced.
   */
  scope: SnippetScope;

  /**
   * When true, user-role tokens cannot delete the snippet.
   */
  deletionLocked: boolean;
}

/**
 * Fields accepted when creating or updating a hub snippet via admin routes.
 */
export interface TeamHubAdminSnippetInput {
  /**
   * Display name shown in snippet pickers.
   */
  name: string;

  /**
   * JavaScript source executed when the snippet is referenced.
   */
  code: string;

  /**
   * Script phases where the snippet may be referenced.
   */
  scope: SnippetScope;
}

/**
 * Run result record returned by Team Hub admin run-result management routes.
 */
export interface TeamHubAdminRunResult {
  /**
   * Run result UUID on the hub server.
   */
  id: string;

  /**
   * User-facing label for list rows.
   */
  label: string;

  /**
   * Whether the snapshot is a collection-wide or single-request run.
   */
  kind: RunResultsExportKind;

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
  summary: CollectionRunnerSummary;

  /**
   * ISO timestamp when the run result was saved.
   */
  createdAt: string;
}

/**
 * Config section name reported by `POST /admin/config/reload`.
 */
export type ReloadConfigSectionName =
  | 'db'
  | 'redis'
  | 'llm'
  | 'plugins'
  | 'docs'
  | 'server'
  | 'collaboration';

/**
 * Outcome for a single config section during reload.
 */
export type ReloadConfigSectionStatus = 'reloaded' | 'unchanged' | 'failed' | 'restart-required';

/**
 * Per-section reload outcome from `POST /admin/config/reload`.
 */
export interface ReloadConfigSectionResult {
  /**
   * Config section that was evaluated.
   */
  section: ReloadConfigSectionName;

  /**
   * Whether the section was applied, skipped, failed, or needs a process restart.
   */
  status: ReloadConfigSectionStatus;

  /**
   * Human-readable error when status is `failed` or `restart-required`.
   */
  error?: string;
}

/**
 * Response body from `POST /admin/config/reload`.
 */
export interface ReloadConfigResponse {
  /**
   * Per-section reload outcomes when the config file parsed successfully.
   */
  sections: ReloadConfigSectionResult[];

  /**
   * When set, the config file could not be read or parsed; no sections were changed.
   */
  fatalError?: string;
}

/**
 * Partial fields accepted when updating a Team Hub user via management routes.
 */
export interface UpdateHubUserInput {
  /**
   * New unique display name, when changing the account label.
   */
  name?: string;

  /**
   * New role, when changing account capabilities.
   */
  role?: 'admin' | 'user';

  /**
   * Replacement collection access list.
   */
  collectionAccess?: string[];

  /**
   * Replacement environment access list.
   */
  environmentAccess?: string[];

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
   * Cropped avatar image as a data URL (`data:image/…;base64,…`).
   *
   * Pass `null` to clear a previously uploaded image.
   */
  imageDataUrl?: string | null;
}

/**
 * Fields required to create a Team Hub user via management routes.
 */
export interface CreateHubUserInput {
  /**
   * Unique display name for the new account.
   */
  name: string;

  /**
   * Role assigned to the new account.
   */
  role: 'admin' | 'user';

  /**
   * Collection access list; admins store an empty array.
   */
  collectionAccess?: string[];

  /**
   * Environment access list; admins store an empty array.
   */
  environmentAccess?: string[];

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
}

/**
 * API token metadata returned by admin token routes.
 */
export interface HubApiTokenRecord {
  /**
   * Stable token record identifier.
   */
  id: string;

  /**
   * Owning user account identifier.
   */
  userId: string;

  /**
   * Human-readable label chosen when the token was created.
   */
  name: string;

  /**
   * Non-secret prefix shown in operator listings.
   */
  tokenPrefix: string;

  /**
   * ISO 8601 timestamp when the token was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the token was last used, if ever.
   */
  lastUsedAt: string | null;

  /**
   * ISO 8601 timestamp when the token was revoked; null when active.
   */
  revokedAt: string | null;
}

/**
 * Device key metadata returned by enrollment and admin device routes.
 */
export interface HubDeviceKeyRecord {
  /**
   * Stable device key record identifier.
   */
  id: string;

  /**
   * Owning user account identifier.
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
   * Format of the uploaded public key material.
   */
  keyFormat: 'identity-v1' | 'mls-key-package';

  /**
   * sha256 hex digest of the uploaded public key material.
   */
  fingerprint: string;

  /**
   * Short fingerprint prefix for operator listings.
   */
  fingerprintPrefix: string;

  /**
   * ISO 8601 timestamp when the device was enrolled.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the device last confirmed enrollment, if tracked.
   */
  lastSeenAt: string | null;

  /**
   * ISO 8601 timestamp when the device was revoked; null when active.
   */
  revokedAt: string | null;
}

/**
 * Local and server enrollment status for the current device on one Team Hub.
 */
export interface TeamHubDeviceEnrollmentStatus {
  /**
   * True when local encrypted keys exist for this hub.
   */
  hasLocalIdentity: boolean;

  /**
   * True when the server reports an enrollment for the local device id.
   */
  isEnrolledOnServer: boolean;

  /**
   * True when the local device id matches an active, non-revoked server record.
   */
  isActiveEnrollment: boolean;

  /**
   * Locally stored identity metadata, if present.
   */
  localIdentity?: {
    hubId: string;
    userId: string;
    deviceId: string;
    serverDeviceKeyId: string;
    label: string;
    fingerprint: string;
    enrolledAt: string;
  };

  /**
   * Matching server enrollment record, if present.
   */
  serverDevice?: HubDeviceKeyRecord;
}

/**
 * Input for enrolling the current device on an E2EE-enabled Team Hub.
 */
export interface EnrollHubDeviceInput {
  /**
   * Client-generated stable device identifier.
   */
  deviceId: string;

  /**
   * Human-readable label for admin listings.
   */
  label: string;

  /**
   * Base64-encoded public key material uploaded to the hub.
   */
  publicKeyMaterial: string;

  /**
   * Format of {@link publicKeyMaterial}; defaults to identity-v1 on the server.
   */
  keyFormat?: 'identity-v1' | 'mls-key-package';
}

/**
 * Response from creating a user account and initial API token.
 */
export interface CreatedHubUser {
  /**
   * Newly created user account.
   */
  user: HubUserRecord;

  /**
   * Metadata for the initial bearer token.
   */
  token: HubApiTokenRecord;

  /**
   * One-time plaintext bearer token secret.
   */
  secret: string;
}

/**
 * Request body for creating an additional API token for a user.
 */
export interface CreateHubTokenInput {
  /**
   * Human-readable label for the new token.
   */
  name: string;
}

/**
 * Response from creating an additional API bearer token.
 */
export interface CreatedHubToken {
  /**
   * Metadata for the newly created bearer token.
   */
  token: HubApiTokenRecord;

  /**
   * One-time plaintext bearer token secret.
   */
  secret: string;
}

/**
 * Computed lifecycle status for an onboarding invitation.
 */
export type HubInvitationStatus = 'pending' | 'redeemed' | 'revoked' | 'expired';

/**
 * Onboarding invitation metadata returned by admin routes.
 */
export interface HubInvitationRecord {
  /**
   * Stable invitation record identifier.
   */
  id: string;

  /**
   * Invited user account identifier.
   */
  userId: string;

  /**
   * Non-secret prefix shown in operator listings.
   */
  codePrefix: string;

  /**
   * ISO 8601 timestamp when the invitation expires.
   */
  expiresAt: string;

  /**
   * ISO 8601 timestamp when the invitation was redeemed, if ever.
   */
  redeemedAt: string | null;

  /**
   * ISO 8601 timestamp when the invitation was revoked, if ever.
   */
  revokedAt: string | null;

  /**
   * ISO 8601 timestamp when the invitation was created.
   */
  createdAt: string;

  /**
   * Derived lifecycle status for operator UI.
   */
  status: HubInvitationStatus;
}

/**
 * Fields required to create an invited user and onboarding invitation.
 */
export interface CreateInvitedHubUserInput extends CreateHubUserInput {
  /**
   * Hours until the invitation expires; server default applies when omitted.
   */
  expiresInHours?: number;
}

/**
 * Response from creating an invited user or reissuing an invitation.
 */
export interface CreatedInvitedHubUser {
  /**
   * Invited user account.
   */
  user: HubUserRecord;

  /**
   * Metadata for the onboarding invitation.
   */
  invitation: HubInvitationRecord;

  /**
   * One-time plaintext invitation secret.
   */
  secret: string;
}

/**
 * Request body for reissuing an invitation for an existing user.
 */
export interface CreateUserInvitationInput {
  /**
   * Hours until the replacement invitation expires; server default applies when omitted.
   */
  expiresInHours?: number;
}

/**
 * User details returned by invitation preview without issuing a token.
 */
export interface HubInvitationPreviewUser {
  /**
   * Display name for the invited account.
   */
  name: string;

  /**
   * Role that will be granted when the invitation is redeemed.
   */
  role: 'admin' | 'user';

  /**
   * Collection ids the invited user may access, or `['*']` for all collections.
   */
  collectionAccess: string[];

  /**
   * Environment ids the invited user may access, or `['*']` for all environments.
   */
  environmentAccess: string[];

  /**
   * Snippet ids the invited user may access, or `['*']` for all snippets.
   */
  snippetAccess: string[];

  /**
   * Whether the invited user may call hub-proxied LLM routes.
   */
  llmAccess: boolean;

  /**
   * LLM model ids the invited user may use, or `['*']` for all hub-offered models.
   */
  llmModels: string[];
}

/**
 * Response body from invitation preview routes.
 */
export interface HubInvitationPreview {
  /**
   * Non-sensitive invited user details for confirmation UI.
   */
  user: HubInvitationPreviewUser;

  /**
   * ISO 8601 timestamp when the invitation expires.
   */
  expiresAt: string;
}

/**
 * Verified Team Hub session returned after redeeming an invitation.
 */
export interface TeamHubVerifiedSession {
  /**
   * User account owning the authenticated bearer token.
   */
  user: {
    /**
     * Stable user account identifier.
     */
    id: string;

    /**
     * Unique display name for the account.
     */
    name: string;

    /**
     * Account role determining API capabilities.
     */
    role: 'admin' | 'user';
  };

  /**
   * Derived capability flags for clients such as HarborClient.
   */
  capabilities: {
    /**
     * When true, the token may call entity data routes.
     */
    dataApi: boolean;

    /**
     * When true, the token may call management routes.
     */
    managementApi: boolean;

    /**
     * When true, the token may call hub-proxied LLM routes.
     */
    llm: boolean;
  };
}

/**
 * Result of redeeming an invitation and verifying the issued bearer token.
 */
export interface TeamHubInvitationRedeemResult {
  /**
   * One-time plaintext bearer token secret.
   */
  secret: string;

  /**
   * Verified session for the redeemed bearer token.
   */
  session: TeamHubVerifiedSession;
}

/**
 * Entity kinds that can host a Team Hub discussion thread.
 */
export type TeamHubDiscussionEntityType = 'request' | 'collection' | 'folder' | 'runResult';

/**
 * Target entity for Team Hub discussion IPC calls.
 */
export interface TeamHubDiscussionTarget {
  /**
   * Entity kind hosting the discussion.
   */
  entityType: TeamHubDiscussionEntityType;

  /**
   * Server-side entity UUID.
   */
  entityId: string;
}

/**
 * Avatar presentation metadata returned with discussion authors.
 */
export interface TeamHubDiscussionAuthorAvatar {
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
export interface TeamHubDiscussionAuthor {
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
  avatar?: TeamHubDiscussionAuthorAvatar;
}

/**
 * Encrypted discussion payload metadata returned by E2EE Team Hub routes.
 */
export interface TeamHubDiscussionEncryptedPayload {
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
export interface TeamHubDiscussionComment {
  /**
   * Stable comment identifier.
   */
  id: string;

  /**
   * Target entity kind for this comment tree.
   */
  entityType: TeamHubDiscussionEntityType;

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
  encryptedPayload?: TeamHubDiscussionEncryptedPayload | null;

  /**
   * Author metadata for display and permissions.
   */
  author: TeamHubDiscussionAuthor;

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
export interface TeamHubListDiscussionsResponse {
  /**
   * Comments in server sort order for the requested page.
   */
  comments: TeamHubDiscussionComment[];

  /**
   * Opaque cursor for the next page, when more comments exist.
   */
  nextCursor?: string;
}

/**
 * Query parameters accepted by discussion list routes.
 */
export interface TeamHubListDiscussionsQuery {
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
export interface TeamHubCreateDiscussionInput {
  /**
   * Plaintext comment body for non-E2EE hubs.
   */
  body: string;

  /**
   * Parent comment id when creating a reply instead of a root comment.
   */
  parentCommentId?: string;
}

/**
 * Request body for updating an existing discussion comment.
 */
export interface TeamHubUpdateDiscussionInput {
  /**
   * Replacement comment body text.
   */
  body: string;
}

/**
 * Collaboration notice event kinds emitted by Team Hub.
 */
export type TeamHubNoticeEventType =
  | 'request.updated'
  | 'discussion.comment'
  | 'discussion.reply'
  | 'discussion.mention'
  | 'runResult.created'
  | 'runResult.failed';

/**
 * Per-user notification delivery preference.
 */
export type TeamHubNotificationLevel = 'all' | 'mentions' | 'none';

/**
 * Avatar presentation metadata returned with notice actors.
 */
export interface TeamHubNoticeActorAvatar {
  /**
   * One or two uppercase initials shown in the avatar badge.
   */
  initials: string;

  /**
   * Persisted avatar background color key (for example `sky-600`).
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
export interface TeamHubNoticeActor {
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
  avatar?: TeamHubNoticeActorAvatar;
}

/**
 * Display metadata denormalized onto notice rows for feed rendering.
 */
export interface TeamHubNoticeDisplayMetadata {
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
  eventType: TeamHubNoticeEventType;

  /**
   * Primary entity type the notice deep-links to.
   */
  entityType: TeamHubDiscussionEntityType;

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
  actor: TeamHubNoticeActor;

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
  displayMetadata: TeamHubNoticeDisplayMetadata;
}

/**
 * Paginated list response from `GET /notices`.
 */
export interface TeamHubListNoticesResponse {
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
export interface TeamHubListNoticesQuery {
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
export interface TeamHubNoticesUnreadCountResponse {
  /**
   * Number of unread notices for the authenticated user.
   */
  count: number;
}

/**
 * Compact notice event payload pushed from the main-process SSE subscription.
 */
export interface TeamHubNoticeStreamEvent {
  /**
   * Payload schema version.
   */
  v: 1;

  /**
   * Notice event kind.
   */
  type: 'notice.created';

  /**
   * Stable notice identifier.
   */
  noticeId: string;

  /**
   * Unread notice count after the event.
   */
  unreadCount: number;
}

/**
 * IPC payload emitted when a Team Hub notice SSE stream delivers data or reconnects.
 */
export type TeamHubNoticeStreamMessage =
  | {
      /**
       * Team hub connection id that produced the message.
       */
      hubId: string;

      /**
       * Message kind discriminator.
       */
      kind: 'event';

      /**
       * Parsed notice stream event.
       */
      event: TeamHubNoticeStreamEvent;
    }
  | {
      /**
       * Team hub connection id that reconnected.
       */
      hubId: string;

      /**
       * Message kind discriminator.
       */
      kind: 'reconnected';

      /**
       * REST-reconciled unread notice count after reconnect.
       */
      unreadCount: number;
    };

/**
 * Current notification settings for the authenticated user.
 */
export interface TeamHubNotificationSettings {
  /**
   * Delivery preference for collaboration notices.
   */
  level: TeamHubNotificationLevel;

  /**
   * ISO 8601 timestamp when the settings were last updated.
   */
  updatedAt: string;
}

/**
 * Request body for updating notification settings.
 */
export interface TeamHubUpdateNotificationSettingsInput {
  /**
   * Replacement notification delivery preference.
   */
  level: TeamHubNotificationLevel;
}

/**
 * Thread subscription state for the authenticated user.
 */
export interface TeamHubDiscussionThreadSubscription {
  /**
   * When true, the user receives notices for this discussion thread.
   */
  subscribed: boolean;

  /**
   * Root comment id identifying the thread.
   */
  rootCommentId: string;
}
