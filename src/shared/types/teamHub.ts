import type { HubLlmModel } from '#/shared/types/ai';
import type { HttpMethod } from '#/shared/types/common';

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
   * When true, the hub server publishes plugin catalog or trusted URLs.
   */
  pluginCatalog: boolean;

  /**
   * When true, the hub server exposes snippet storage routes.
   */
  snippets: boolean;

  /**
   * When true, this connection uses an admin token with management API access.
   */
  admin: boolean;
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
   * Human-readable error when the scan failed; omitted on success.
   */
  error?: string;
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
   * Zero-based sort order within the collection.
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
