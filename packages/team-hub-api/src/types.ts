import type { BodyType, HttpMethod, HubLlmModel, KeyValue, Variable } from './appTypes.js';
import type { TeamHubAuthConfig } from './auth.js';

/**
 * Response body from `GET /plugins/sources`.
 */
export interface PluginSourcesResponse {
  /**
   * Plugin marketplace catalog JSON URLs configured on the Team Hub.
   */
  catalogs: string[];

  /**
   * Trusted publisher signing-key registry JSON URLs configured on the Team Hub.
   */
  trusted: string[];
}

/**
 * Connection settings for {@link TeamHubClient}.
 */
export interface TeamHubClientConfig {
  /**
   * HarborClient Server base URL (for example `http://127.0.0.1:8788`).
   */
  baseUrl: string;

  /**
   * Bearer token prefixed with `hbk_` for protected routes.
   *
   * Omit when calling only public routes such as invitation preview and redeem.
   */
  token?: string;

  /**
   * Request timeout in milliseconds; defaults to 30 seconds when omitted.
   */
  requestTimeoutMs?: number;
}

/**
 * Response body from `GET /health`.
 */
export interface HealthResponse {
  /**
   * Fixed status literal reported by the server.
   */
  status: 'ok';

  /**
   * HarborClient Server application version string.
   */
  version: string;
}

/**
 * Team Hub account role returned by session introspection.
 */
export type HubUserRole = 'admin' | 'user';

/**
 * Capability flags derived from the authenticated Team Hub user account.
 */
export interface SessionCapabilities {
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
}

/**
 * Response body from `GET /auth/session`.
 */
export interface SessionResponse {
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
    role: HubUserRole;
  };

  /**
   * Metadata for the API token used to authenticate the request.
   */
  token: {
    /**
     * Stable token record identifier.
     */
    id: string;

    /**
     * Non-secret prefix shown in operator listings.
     */
    prefix: string;
  };

  /**
   * Derived capability flags for clients such as HarborClient.
   */
  capabilities: SessionCapabilities;
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
  role: HubUserRole;

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
 * Config section name reported by `POST /admin/config/reload`.
 */
export type ReloadConfigSectionName = 'db' | 'redis' | 'llm' | 'plugins' | 'server';

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
  role?: HubUserRole;

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
  role: HubUserRole;

  /**
   * Collection access list; admins store an empty array.
   */
  collectionAccess?: string[];

  /**
   * Environment access list; admins store an empty array.
   */
  environmentAccess?: string[];

  /**
   * Snippet access list; admins store an empty array.
   */
  snippetAccess?: string[];

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
 * Computed lifecycle status for an onboarding invitation.
 */
export type HubInvitationStatus = 'pending' | 'redeemed' | 'revoked' | 'expired';

/**
 * Onboarding invitation metadata returned by admin and preview routes.
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
 * Request body for `POST /auth/invitations/preview`.
 */
export interface PreviewHubInvitationInput {
  /**
   * Invitation secret supplied by the operator or invitee.
   */
  secret: string;
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
  role: HubUserRole;

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
 * Response body from `POST /auth/invitations/preview`.
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
 * Request body for `POST /auth/invitations/redeem`.
 */
export interface RedeemHubInvitationInput {
  /**
   * Invitation secret supplied by the invitee.
   */
  secret: string;

  /**
   * Human-readable label for the issued API token, when customizing the default.
   */
  tokenName?: string;
}

/**
 * Request body for `POST /admin/users/:id/invitations`.
 */
export interface CreateUserInvitationInput {
  /**
   * Hours until the replacement invitation expires; server default applies when omitted.
   */
  expiresInHours?: number;
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
 * Collection record returned by HarborClient Server entity routes.
 */
export interface CollectionRecord {
  /**
   * Collection UUID.
   */
  id: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Collection-scoped variables for `{{key}}` substitution.
   */
  variables: Variable[];

  /**
   * Default headers applied to requests in this collection.
   */
  headers: KeyValue[];

  /**
   * Default authorization settings for requests in this collection.
   */
  auth: TeamHubAuthConfig;

  /**
   * JavaScript run before each request in this collection.
   */
  preRequestScript: string;

  /**
   * JavaScript run after each request in this collection.
   */
  postRequestScript: string;

  /**
   * ISO 8601 timestamp when the collection was created.
   */
  createdAt: string;

  /**
   * When true, non-admin users cannot delete this collection on the hub.
   */
  deletionLocked: boolean;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `POST /collections`.
 */
export interface CreateCollectionInput {
  /**
   * Display name for the new collection.
   */
  name: string;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `PUT /collections/:id`.
 */
export interface UpdateCollectionInput {
  /**
   * Updated display name.
   */
  name: string;

  /**
   * Collection-scoped variables.
   */
  variables: Variable[];

  /**
   * Default headers for requests in this collection.
   */
  headers: KeyValue[];

  /**
   * Pre-request script source.
   */
  preRequestScript: string;

  /**
   * Post-request script source.
   */
  postRequestScript: string;

  /**
   * Default authorization settings.
   */
  auth: TeamHubAuthConfig;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Environment record returned by HarborClient Server entity routes.
 */
export interface EnvironmentRecord {
  /**
   * Environment UUID.
   */
  id: string;

  /**
   * Display name shown in the environment picker.
   */
  name: string;

  /**
   * Environment-scoped variables.
   */
  variables: Variable[];

  /**
   * ISO 8601 timestamp when the environment was created.
   */
  createdAt: string;

  /**
   * When true, non-admin users cannot delete this environment on the hub.
   */
  deletionLocked: boolean;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;

  /**
   * Parent environment id for inheritance, or null when a root.
   */
  parentUuid?: string | null;
}

/**
 * Request body for `POST /environments`.
 */
export interface CreateEnvironmentInput {
  /**
   * Display name for the new environment.
   */
  name: string;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `PUT /environments/:id`.
 */
export interface UpdateEnvironmentInput {
  /**
   * Updated display name.
   */
  name: string;

  /**
   * Environment-scoped variables.
   */
  variables: Variable[];

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;

  /**
   * Parent environment id; `null` clears; omit to leave unchanged.
   */
  parentUuid?: string | null;
}

/**
 * Script phases where a snippet may be referenced.
 */
export type SnippetScope = 'pre-request' | 'post-request' | 'any';

/**
 * Snippet record returned by HarborClient Server entity routes.
 */
export interface SnippetRecord {
  /**
   * Snippet UUID.
   */
  id: string;

  /**
   * Display name shown in settings and script pickers.
   */
  name: string;

  /**
   * JavaScript source executed when the snippet is referenced.
   */
  code: string;

  /**
   * Script phases where this snippet may be referenced.
   */
  scope: SnippetScope;

  /**
   * ISO 8601 timestamp when the snippet was created.
   */
  createdAt: string;

  /**
   * When true, non-admin users cannot delete this snippet on the hub.
   */
  deletionLocked: boolean;
}

/**
 * Request body for `POST /snippets`.
 */
export interface CreateSnippetInput {
  /**
   * Display name for the new snippet.
   */
  name: string;

  /**
   * JavaScript source for the new snippet.
   */
  code?: string;

  /**
   * Script phases where this snippet may be referenced.
   */
  scope?: SnippetScope;
}

/**
 * Request body for `PUT /snippets/:id`.
 */
export interface UpdateSnippetInput {
  /**
   * Updated display name.
   */
  name: string;

  /**
   * Updated JavaScript source.
   */
  code: string;

  /**
   * Script phases where this snippet may be referenced.
   */
  scope: SnippetScope;
}

/**
 * Folder record returned by HarborClient Server entity routes.
 */
export interface FolderRecord {
  /**
   * Folder UUID.
   */
  id: string;

  /**
   * Parent collection UUID.
   */
  collectionId: string;

  /**
   * Parent folder UUID, or `null` when at the collection root.
   */
  parentFolderId: string | null;

  /**
   * Display name shown in the collection tree.
   */
  name: string;

  /**
   * Zero-based sort order within the collection.
   */
  sortOrder: number;

  /**
   * ISO 8601 timestamp when the folder was created.
   */
  createdAt: string;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `POST /collections/:collectionId/folders`.
 */
export interface CreateFolderInput {
  /**
   * Display name for the new folder.
   */
  name: string;

  /**
   * Parent folder UUID, or omitted/`null` for the collection root.
   */
  parentFolderId?: string | null;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `PATCH /folders/:id`.
 */
export interface RenameFolderInput {
  /**
   * Updated folder display name.
   */
  name: string;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `PUT /collections/:collectionId/folders/reorder`.
 */
export interface ReorderFoldersInput {
  /**
   * Parent folder UUID, or `null` to reorder collection-root folders.
   */
  parentFolderId: string | null;

  /**
   * Folder ids in the desired display order.
   */
  orderedFolderIds: string[];
}

/**
 * Request body for `PUT /folders/:id/move`.
 */
export interface MoveFolderInput {
  /**
   * Destination parent folder UUID, or `null` for the collection root.
   */
  parentFolderId: string | null;

  /**
   * Optional zero-based index among destination siblings.
   */
  sortOrder?: number;
}

/**
 * Saved request record returned by HarborClient Server entity routes.
 */
export interface SavedRequestRecord {
  /**
   * Saved request UUID.
   */
  id: string;

  /**
   * Parent collection UUID.
   */
  collectionId: string;

  /**
   * Display name shown in the collection tree.
   */
  name: string;

  /**
   * HTTP method for the saved request.
   */
  method: HttpMethod;

  /**
   * Request URL template or absolute URL.
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
   * Authorization settings for this request.
   */
  auth: TeamHubAuthConfig;

  /**
   * Request body content.
   */
  body: string;

  /**
   * Request body content type.
   */
  bodyType: BodyType;

  /**
   * Pre-request script source.
   */
  preRequestScript: string;

  /**
   * Post-request script source.
   */
  postRequestScript: string;

  /**
   * Optional user comment or description.
   */
  comment: string;

  /**
   * Parent folder UUID, or `null` when at the collection root.
   */
  folderId: string | null;

  /**
   * Zero-based sort order within the folder or collection root.
   */
  sortOrder: number;

  /**
   * ISO 8601 timestamp when the request was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the request was last updated.
   */
  updatedAt: string;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `POST /collections/:collectionId/requests`.
 */
export interface CreateRequestInput {
  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * HTTP method.
   */
  method: HttpMethod;

  /**
   * Request URL.
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
  auth: TeamHubAuthConfig;

  /**
   * Request body content.
   */
  body: string;

  /**
   * Request body content type.
   */
  bodyType: BodyType;

  /**
   * Pre-request script source.
   */
  preRequestScript: string;

  /**
   * Post-request script source.
   */
  postRequestScript: string;

  /**
   * Optional user comment.
   */
  comment: string;

  /**
   * Parent folder UUID, or omitted/`null` for the collection root.
   */
  folderId?: string | null;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `PUT /requests/:id`.
 */
export interface UpdateRequestInput extends CreateRequestInput {
  /**
   * Parent collection UUID (required on update).
   */
  collectionId: string;
}

/**
 * Request body for `PUT /collections/:collectionId/requests/reorder`.
 */
export interface ReorderRequestsInput {
  /**
   * Folder UUID, or `null` to reorder requests at the collection root.
   */
  folderId: string | null;

  /**
   * Request ids in the desired display order.
   */
  orderedRequestIds: string[];
}

/**
 * Request body for `PUT /requests/:id/move`.
 */
export interface MoveRequestInput {
  /**
   * Destination folder UUID, or `null` for the collection root.
   */
  folderId: string | null;

  /**
   * Zero-based index within the destination folder or root.
   */
  index: number;
}

/**
 * Markdown document record returned by HarborClient Server entity routes.
 */
export interface DocumentRecord {
  /**
   * Document UUID.
   */
  id: string;

  /**
   * Parent collection UUID.
   */
  collectionId: string;

  /**
   * Parent folder UUID, or `null` when at the collection root.
   */
  folderId: string | null;

  /**
   * Display name shown in the collection tree.
   */
  name: string;

  /**
   * Markdown body content.
   */
  content: string;

  /**
   * Zero-based sort order within the folder or collection root.
   */
  sortOrder: number;

  /**
   * ISO 8601 timestamp when the document was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the document was last updated.
   */
  updatedAt: string;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `POST /collections/:collectionId/documents`.
 */
export interface CreateDocumentInput {
  /**
   * Display name for the document.
   */
  name: string;

  /**
   * Markdown body content.
   */
  content: string;

  /**
   * Parent folder UUID, or omitted/`null` for the collection root.
   */
  folderId?: string | null;

  /**
   * Optional sidebar marker token (CSS color string), or null when unset.
   */
  marker?: string | null;
}

/**
 * Request body for `PUT /documents/:id`.
 */
export interface UpdateDocumentInput extends CreateDocumentInput {
  /**
   * Parent collection UUID (required on update).
   */
  collectionId: string;
}

/**
 * Request body for `PUT /collections/:collectionId/documents/reorder`.
 */
export interface ReorderDocumentsInput {
  /**
   * Folder UUID, or `null` to reorder documents at the collection root.
   */
  folderId: string | null;

  /**
   * Document ids in the desired display order.
   */
  orderedDocumentIds: string[];
}

/**
 * Request body for `PUT /documents/:id/move`.
 */
export interface MoveDocumentInput {
  /**
   * Destination folder UUID, or `null` for the collection root.
   */
  folderId: string | null;

  /**
   * Zero-based index within the destination folder or root.
   */
  index: number;
}

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
 * Persisted run result metadata returned by list and detail routes.
 */
export interface RunResultRecord {
  /**
   * Stable run result UUID used in deep links.
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
   * ISO timestamp when the run result was saved.
   */
  createdAt: string;

  /**
   * User who saved the run result, when known.
   */
  createdByUserId: string | null;
}

/**
 * Full run result including the serialized HarborClient export payload.
 */
export interface RunResultDetail extends RunResultRecord {
  /**
   * Complete run-results export JSON stored with the snapshot.
   */
  payload: Record<string, unknown>;
}

/**
 * Request body for `POST /run-results`.
 */
export interface CreateRunResultInput {
  /**
   * Optional display label; generated on the server when omitted.
   */
  label?: string;

  /**
   * HarborClient run-results export payload to persist.
   */
  payload: Record<string, unknown>;
}
