import type {
  AuthConfig,
  BodyType,
  HttpMethod,
  HubLlmModel,
  KeyValue,
  Variable
} from '#/shared/types';

/**
 * Connection settings for {@link HarborTeamHubClient}.
 */
export interface TeamHubClientConfig {
  /**
   * HarborClient Server base URL (for example `http://127.0.0.1:8788`).
   */
  baseUrl: string;

  /**
   * Bearer token prefixed with `hbk_` for protected routes.
   */
  token: string;

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
  auth: AuthConfig;

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
}

/**
 * Request body for `POST /collections`.
 */
export interface CreateCollectionInput {
  /**
   * Display name for the new collection.
   */
  name: string;
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
  auth: AuthConfig;
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
}

/**
 * Request body for `POST /environments`.
 */
export interface CreateEnvironmentInput {
  /**
   * Display name for the new environment.
   */
  name: string;
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
}

/**
 * Request body for `POST /collections/:collectionId/folders`.
 */
export interface CreateFolderInput {
  /**
   * Display name for the new folder.
   */
  name: string;
}

/**
 * Request body for `PATCH /folders/:id`.
 */
export interface RenameFolderInput {
  /**
   * Updated folder display name.
   */
  name: string;
}

/**
 * Request body for `PUT /collections/:collectionId/folders/reorder`.
 */
export interface ReorderFoldersInput {
  /**
   * Folder ids in the desired display order.
   */
  orderedFolderIds: string[];
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
  auth: AuthConfig;

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
  auth: AuthConfig;

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
