import type {
  AuditLogRecord,
  AuthConfig,
  CollectionRecord,
  CreateRunResultInput,
  CreateLivePageRecordInput,
  CreateLiveServerRecordInput,
  CreateUserInput,
  CreatedInvitedUserResult,
  EnvironmentRecord,
  FolderRecord,
  InvitationRecord,
  KeyValue,
  ListAuditLogOptions,
  RedeemedInvitationResult,
  SaveRequestInput,
  SaveDocumentInput,
  SavedRequestRecord,
  DocumentRecord,
  SnippetRecord,
  SnippetScope,
  TenantAvatarImageUpdate,
  TenantRecord,
  UpdateUserInput,
  UserRecord,
  Variable,
  LlmUsageRecord,
  CreateLlmUsageLogInput,
  LlmUsageLogRecord,
  RunResultRecord,
  LivePageRecord,
  LiveServerRecord,
  UpdateLivePageRecordInput,
  UpdateLiveServerRecordInput,
  DiscussionCommentRecord,
  CreateDiscussionCommentInput,
  UpdateDiscussionCommentInput,
  ListDiscussionCommentsOptions,
  ListDiscussionCommentsResult,
  NoticeRecord,
  CreateNoticeInput,
  ListNoticesOptions,
  ListNoticesResult,
  NotificationLevel,
  UserNotificationSettingsRecord,
  DiscussionThreadSubscriptionRecord,
  DiscussionMlsGroupStateRecord,
  DiscussionMlsCommitRecord,
  DiscussionMlsWelcomeRecord,
  UpsertDiscussionMlsGroupStateInput,
  ListDiscussionMlsCommitsOptions,
  ListDiscussionMlsCommitsResult,
  ListDiscussionMlsWelcomesOptions,
  ListDiscussionMlsWelcomesResult
} from '#/db/types.js';
import type { ApiTokenRecord, DeviceKeyRecord } from '#/db/types.js';

/**
 * Common contract for Team Hub database backends.
 */
export interface IDatabase {
  /**
   * Opens a connection pool or client to the configured database.
   */
  connect(): Promise<void>;

  /**
   * Closes open connections and releases resources.
   */
  disconnect(): Promise<void>;

  /**
   * Verifies the database is reachable with a minimal round-trip.
   *
   * Used by readiness probes so orchestrators can stop routing traffic when
   * the backend is down without treating process liveness as a dependency check.
   *
   * @throws {Error} When the database is not connected or the ping fails.
   */
  ping(): Promise<void>;

  /**
   * Creates required tables or indexes when absent.
   *
   * SQL backends run DDL; Firestore treats schema as implicit and performs no work.
   */
  migrate(): Promise<void>;

  /**
   * Returns the tenant id this database handle is scoped to.
   */
  getTenantId(): string;

  /**
   * Returns a database handle scoped to the given tenant.
   *
   * The returned handle shares the underlying connection with this instance.
   * Entity reads and writes are isolated to `tenantId`.
   *
   * @param tenantId - Tenant namespace to bind.
   */
  forTenant(tenantId: string): IDatabase;

  /**
   * Ensures the reserved default tenant row exists.
   *
   * Idempotent; safe to call from migrate and CLI startup.
   */
  ensureDefaultTenant(): Promise<void>;

  /**
   * Lists all tenant records ordered by id.
   */
  listTenants(): Promise<TenantRecord[]>;

  /**
   * Creates a non-default tenant namespace.
   *
   * @param id - Stable tenant identifier.
   * @param name - Human-readable tenant label.
   * @param actingUserId - User performing the create action.
   * @returns The newly created tenant record.
   */
  createTenant(id: string, name: string, actingUserId: string): Promise<TenantRecord>;

  /**
   * Finds a tenant by stable identifier.
   *
   * @param id - Tenant identifier to look up.
   */
  findTenantById(id: string): Promise<TenantRecord | null>;

  /**
   * Updates persisted hub avatar presentation for a tenant namespace.
   *
   * @param id - Tenant identifier to update.
   * @param avatarInitials - Initials tile text to persist.
   * @param avatarColor - Palette color key to persist.
   * @param actingUserId - User performing the update, or null for system assignment.
   * @param image - Optional uploaded image fields; omit to leave the image unchanged.
   * @returns Updated tenant record.
   */
  updateTenantAvatar(
    id: string,
    avatarInitials: string,
    avatarColor: string,
    actingUserId: string | null,
    image?: TenantAvatarImageUpdate
  ): Promise<TenantRecord>;

  /**
   * Deletes a non-default tenant and all of its tenant-scoped data.
   *
   * @param id - Tenant identifier to delete.
   * @param actingUserId - User performing the delete action.
   */
  deleteTenant(id: string, actingUserId: string): Promise<void>;

  /**
   * Returns the stable identifier of the internal system user, when provisioned.
   */
  getSystemUserId(): string | null;

  /**
   * Provisions the internal system user when missing and caches its id.
   *
   * Idempotent and safe to call on every connect; assumes migrations have
   * already created the schema. Scoped to the current tenant.
   */
  ensureSystemUser(): Promise<void>;

  /**
   * Lists audit log entries ordered newest-first with optional filters.
   *
   * @param options - Optional limit and filter criteria.
   */
  listAuditLog(options?: ListAuditLogOptions): Promise<AuditLogRecord[]>;

  /**
   * Creates a new user account.
   *
   * @param input - User fields to persist.
   * @param actingUserId - User performing the create action.
   * @returns The newly created user record.
   */
  createUser(input: CreateUserInput, actingUserId: string): Promise<UserRecord>;

  /**
   * Finds a user by stable identifier.
   *
   * @param id - User identifier to look up.
   * @returns Matching user record, or null when not found.
   */
  findUserById(id: string): Promise<UserRecord | null>;

  /**
   * Finds a user by unique display name.
   *
   * @param name - User name to look up.
   * @returns Matching user record, or null when not found.
   */
  findUserByName(name: string): Promise<UserRecord | null>;

  /**
   * Lists all user accounts ordered by name.
   */
  listUsers(): Promise<UserRecord[]>;

  /**
   * Updates an existing user account.
   *
   * @param id - User identifier to update.
   * @param input - Partial fields to apply.
   * @param actingUserId - User performing the update action.
   * @returns The updated user record.
   */
  updateUser(id: string, input: UpdateUserInput, actingUserId: string): Promise<UserRecord>;

  /**
   * Deletes a user account and permanently removes all of their API tokens.
   *
   * @param id - User identifier to delete.
   * @param actingUserId - User performing the delete action.
   */
  deleteUser(id: string, actingUserId: string): Promise<void>;

  /**
   * Assigns legacy API tokens without an owner to the bootstrap user.
   *
   * Idempotent: no-op when no orphan tokens exist.
   */
  migrateOrphanTokensToBootstrapUser(): Promise<void>;

  /**
   * Persists a newly generated API token record.
   *
   * @param record - Token metadata including the stored hash (not the raw secret).
   * @param actingUserId - User performing the create action.
   */
  createApiToken(record: ApiTokenRecord, actingUserId: string): Promise<void>;

  /**
   * Looks up a non-revoked token by its sha256 hash for request authentication.
   *
   * @param tokenHash - sha256 hex digest of the bearer token secret.
   * @returns Matching active token record, or null when not found or revoked.
   */
  findActiveApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | null>;

  /**
   * Returns all API token records ordered newest-first for operator listing.
   */
  listApiTokens(): Promise<ApiTokenRecord[]>;

  /**
   * Returns API tokens owned by a specific user ordered newest-first.
   *
   * @param userId - Owning user identifier.
   */
  listApiTokensByUserId(userId: string): Promise<ApiTokenRecord[]>;

  /**
   * Finds an API token record by stable identifier.
   *
   * @param id - Token identifier to look up.
   * @returns Matching token record, or null when not found.
   */
  findApiTokenById(id: string): Promise<ApiTokenRecord | null>;

  /**
   * Permanently removes an API token record by id.
   *
   * @param id - Token identifier to delete.
   * @param actingUserId - User performing the delete action.
   * @returns True when a token row was removed; false when missing.
   */
  deleteApiToken(id: string, actingUserId: string): Promise<boolean>;

  /**
   * Soft-revokes a token by id.
   *
   * @param id - Token identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   * @returns True when an active token was updated; false when already revoked or missing.
   */
  revokeApiToken(id: string, actingUserId: string): Promise<boolean>;

  /**
   * Updates the last-used timestamp for a token after successful authentication.
   *
   * @param id - Token identifier that authenticated the request.
   * @param when - Timestamp of the authenticated request.
   */
  touchApiTokenLastUsed(id: string, when: Date): Promise<void>;

  /**
   * Persists a newly enrolled device key record with public material only.
   *
   * @param record - Device enrollment metadata to persist.
   * @param actingUserId - User performing the enrollment action.
   */
  createDeviceKey(record: DeviceKeyRecord, actingUserId: string): Promise<void>;

  /**
   * Finds a device key enrollment by stable identifier.
   *
   * @param id - Device key record identifier.
   */
  findDeviceKeyById(id: string): Promise<DeviceKeyRecord | null>;

  /**
   * Finds an active enrollment for a user/device pair.
   *
   * @param userId - Owning user identifier.
   * @param deviceId - Client-generated device identifier.
   */
  findActiveDeviceKeyByUserAndDeviceId(
    userId: string,
    deviceId: string
  ): Promise<DeviceKeyRecord | null>;

  /**
   * Returns device key enrollments owned by a user ordered newest-first.
   *
   * @param userId - Owning user identifier.
   */
  listDeviceKeysByUserId(userId: string): Promise<DeviceKeyRecord[]>;

  /**
   * Returns all device key enrollments ordered newest-first for operator listing.
   */
  listDeviceKeys(): Promise<DeviceKeyRecord[]>;

  /**
   * Soft-revokes a device key enrollment by id.
   *
   * @param id - Device key identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   * @returns True when an active enrollment was updated; false when already revoked or missing.
   */
  revokeDeviceKey(id: string, actingUserId: string): Promise<boolean>;

  /**
   * Updates the last-seen timestamp for an enrolled device.
   *
   * @param id - Device key identifier.
   * @param when - Timestamp of the latest successful enrollment confirmation.
   */
  touchDeviceKeyLastSeen(id: string, when: Date): Promise<void>;

  /**
   * Returns persisted MLS group state for a discussion thread.
   *
   * @param mlsGroupId - Canonical MLS group id for the thread.
   */
  getDiscussionMlsGroupState(mlsGroupId: string): Promise<DiscussionMlsGroupStateRecord | null>;

  /**
   * Inserts or advances MLS group state when the supplied epoch is not stale.
   *
   * @param input - Latest observed MLS epoch for the thread.
   * @param actingUserId - User posting the commit that advanced group state.
   * @returns Persisted group state after the upsert.
   */
  upsertDiscussionMlsGroupState(
    input: UpsertDiscussionMlsGroupStateInput,
    actingUserId: string
  ): Promise<DiscussionMlsGroupStateRecord>;

  /**
   * Persists a relayed MLS commit record built by the route layer.
   *
   * @param record - Validated commit metadata and ciphertext.
   * @param actingUserId - User relaying the commit through Team Hub.
   */
  createDiscussionMlsCommit(record: DiscussionMlsCommitRecord, actingUserId: string): Promise<void>;

  /**
   * Lists MLS commits for offline catch-up with epoch-based cursor pagination.
   *
   * @param options - Group id, optional cursor, and page size.
   */
  listDiscussionMlsCommits(
    options: ListDiscussionMlsCommitsOptions
  ): Promise<ListDiscussionMlsCommitsResult>;

  /**
   * Finds a relayed MLS commit by stable identifier.
   *
   * @param id - Commit record identifier.
   */
  findDiscussionMlsCommitById(id: string): Promise<DiscussionMlsCommitRecord | null>;

  /**
   * Persists a relayed MLS welcome record built by the route layer.
   *
   * @param record - Validated welcome metadata and ciphertext.
   * @param actingUserId - User relaying the welcome through Team Hub.
   */
  createDiscussionMlsWelcome(
    record: DiscussionMlsWelcomeRecord,
    actingUserId: string
  ): Promise<void>;

  /**
   * Lists MLS welcomes for a discussion thread, optionally filtered by recipient device.
   *
   * @param options - Group id and optional recipient device filter.
   */
  listDiscussionMlsWelcomes(
    options: ListDiscussionMlsWelcomesOptions
  ): Promise<ListDiscussionMlsWelcomesResult>;

  /**
   * Finds a relayed MLS welcome by stable identifier.
   *
   * @param id - Welcome record identifier.
   */
  findDiscussionMlsWelcomeById(id: string): Promise<DiscussionMlsWelcomeRecord | null>;

  /**
   * Creates a user account and its initial onboarding invitation in one transaction.
   *
   * @param userId - Pre-generated stable identifier for the new user.
   * @param input - User fields to persist.
   * @param invitation - Invitation metadata including the stored code hash.
   * @param actingUserId - User performing the create action.
   * @returns The created user and invitation records.
   */
  createInvitedUser(
    userId: string,
    input: CreateUserInput,
    invitation: InvitationRecord,
    actingUserId: string
  ): Promise<CreatedInvitedUserResult>;

  /**
   * Persists a new onboarding invitation for an existing user account.
   *
   * @param invitation - Invitation metadata including the stored code hash.
   * @param actingUserId - User performing the create action.
   * @returns The persisted invitation record.
   */
  createInvitation(invitation: InvitationRecord, actingUserId: string): Promise<InvitationRecord>;

  /**
   * Finds an invitation by stable identifier.
   *
   * @param id - Invitation identifier to look up.
   */
  findInvitationById(id: string): Promise<InvitationRecord | null>;

  /**
   * Finds an invitation by the sha256 hash of its secret.
   *
   * @param codeHash - sha256 hex digest of the invitation secret.
   */
  findInvitationByCodeHash(codeHash: string): Promise<InvitationRecord | null>;

  /**
   * Lists all invitations ordered by creation time descending.
   */
  listInvitations(): Promise<InvitationRecord[]>;

  /**
   * Revokes a pending invitation by id.
   *
   * @param id - Invitation identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   * @returns True when a pending invitation was revoked; false when missing or already consumed.
   */
  revokeInvitation(id: string, actingUserId: string): Promise<boolean>;

  /**
   * Atomically consumes a pending invitation and issues a permanent API token.
   *
   * @param codeHash - sha256 hex digest of the invitation secret.
   * @param tokenName - Label stored on the newly created API token.
   * @param actingUserId - Internal user attributed with the redemption action.
   * @returns The owning user, new token metadata, and one-time bearer secret.
   */
  redeemInvitation(
    codeHash: string,
    tokenName: string,
    actingUserId: string
  ): Promise<RedeemedInvitationResult>;

  /**
   * Lists all collections ordered by name.
   *
   * @returns All collections in the database.
   */
  listCollections(): Promise<CollectionRecord[]>;

  /**
   * Creates a new collection with the given name.
   *
   * @param name - Display name for the collection.
   * @param actingUserId - User performing the create action.
   * @returns The newly created collection.
   */
  createCollection(name: string, actingUserId: string): Promise<CollectionRecord>;

  /**
   * Updates a collection's name, variables, headers, and scripts.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Script run before each request in the collection.
   * @param postRequestScript - Script run after each request in the collection.
   * @param auth - Default Authorization settings for requests in the collection.
   * @param actingUserId - User performing the update action.
   * @param marker - Optional sidebar marker; omit to leave the stored value unchanged.
   * @returns The updated collection.
   */
  updateCollection(
    id: string,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    actingUserId: string,
    marker?: string | null
  ): Promise<CollectionRecord>;

  /**
   * Deletes a collection and all of its requests and folders.
   *
   * @param id - Collection ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  deleteCollection(id: string, actingUserId: string): Promise<void>;

  /**
   * Finds a collection by stable identifier.
   *
   * @param id - Collection ID to look up.
   * @returns Matching collection record, or null when not found.
   */
  findCollectionById(id: string): Promise<CollectionRecord | null>;

  /**
   * Updates whether non-admin users may delete a collection.
   *
   * @param id - Collection ID to update.
   * @param deletionLocked - When true, user-role tokens cannot delete the collection.
   * @param actingUserId - Admin user performing the update.
   * @returns Updated collection record.
   */
  setCollectionDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<CollectionRecord>;

  /**
   * Lists all environments ordered by name.
   *
   * @returns All environments in the database.
   */
  listEnvironments(): Promise<EnvironmentRecord[]>;

  /**
   * Creates a new environment with the given name.
   *
   * @param name - Display name for the environment.
   * @param actingUserId - User performing the create action.
   * @returns The newly created environment.
   */
  createEnvironment(name: string, actingUserId: string): Promise<EnvironmentRecord>;

  /**
   * Updates an environment's name, variables, and optional parent link.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @param actingUserId - User performing the update action.
   * @param marker - Optional sidebar marker; omit to leave the stored value unchanged.
   * @param parentUuid - Parent environment id; `null` clears; omit to leave unchanged.
   * @returns The updated environment.
   */
  updateEnvironment(
    id: string,
    name: string,
    variables: Variable[],
    actingUserId: string,
    marker?: string | null,
    parentUuid?: string | null
  ): Promise<EnvironmentRecord>;

  /**
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  deleteEnvironment(id: string, actingUserId: string): Promise<void>;

  /**
   * Finds an environment by stable identifier.
   *
   * @param id - Environment ID to look up.
   * @returns Matching environment record, or null when not found.
   */
  findEnvironmentById(id: string): Promise<EnvironmentRecord | null>;

  /**
   * Updates whether non-admin users may delete an environment.
   *
   * @param id - Environment ID to update.
   * @param deletionLocked - When true, user-role tokens cannot delete the environment.
   * @param actingUserId - Admin user performing the update.
   * @returns Updated environment record.
   */
  setEnvironmentDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<EnvironmentRecord>;

  /**
   * Lists all snippets ordered by sort order then name.
   *
   * @returns All snippets in the database.
   */
  listSnippets(): Promise<SnippetRecord[]>;

  /**
   * Creates a new snippet with the given fields.
   *
   * @param name - Display name for the snippet.
   * @param code - JavaScript source for the snippet.
   * @param scope - Execution scope for the snippet.
   * @param actingUserId - User performing the create action.
   * @returns The newly created snippet.
   */
  createSnippet(
    name: string,
    code: string,
    scope: SnippetScope,
    actingUserId: string
  ): Promise<SnippetRecord>;

  /**
   * Updates a snippet's name, code, and scope. Sort order is left unchanged;
   * HarborClient's snippet update flow does not manage sidebar position.
   *
   * @param id - Snippet ID to update.
   * @param name - New display name.
   * @param code - Updated JavaScript source.
   * @param scope - Updated execution scope.
   * @param actingUserId - User performing the update action.
   * @returns The updated snippet.
   */
  updateSnippet(
    id: string,
    name: string,
    code: string,
    scope: SnippetScope,
    actingUserId: string
  ): Promise<SnippetRecord>;

  /**
   * Deletes a snippet.
   *
   * @param id - Snippet ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  deleteSnippet(id: string, actingUserId: string): Promise<void>;

  /**
   * Finds a snippet by stable identifier.
   *
   * @param id - Snippet ID to look up.
   * @returns Matching snippet record, or null when not found.
   */
  findSnippetById(id: string): Promise<SnippetRecord | null>;

  /**
   * Updates whether non-admin users may delete a snippet.
   *
   * @param id - Snippet ID to update.
   * @param deletionLocked - When true, user-role tokens cannot delete the snippet.
   * @param actingUserId - Admin user performing the update.
   * @returns Updated snippet record.
   */
  setSnippetDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<SnippetRecord>;

  /**
   * Lists all live server records ordered by name.
   */
  listLiveServers(): Promise<LiveServerRecord[]>;
  /**
   * Creates a live server record.
   */
  createLiveServer(
    input: CreateLiveServerRecordInput,
    actingUserId: string
  ): Promise<LiveServerRecord>;
  /**
   * Replaces a live server record.
   */
  updateLiveServer(
    id: string,
    input: UpdateLiveServerRecordInput,
    actingUserId: string
  ): Promise<LiveServerRecord>;
  /**
   * Deletes a live server record.
   */
  deleteLiveServer(id: string, actingUserId: string): Promise<void>;
  /**
   * Finds a live server by id.
   */
  findLiveServerById(id: string): Promise<LiveServerRecord | null>;
  /**
   * Updates a live server deletion lock.
   */
  setLiveServerDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<LiveServerRecord>;

  /**
   * Lists all live page records ordered by name.
   */
  listLivePages(): Promise<LivePageRecord[]>;
  /**
   * Creates a live page record.
   */
  createLivePage(input: CreateLivePageRecordInput, actingUserId: string): Promise<LivePageRecord>;
  /**
   * Replaces a live page record.
   */
  updateLivePage(
    id: string,
    input: UpdateLivePageRecordInput,
    actingUserId: string
  ): Promise<LivePageRecord>;
  /**
   * Deletes a live page record.
   */
  deleteLivePage(id: string, actingUserId: string): Promise<void>;
  /**
   * Finds a live page by id.
   */
  findLivePageById(id: string): Promise<LivePageRecord | null>;
  /**
   * Updates a live page deletion lock.
   */
  setLivePageDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<LivePageRecord>;

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests ordered by sort_order then name.
   */
  listRequests(collectionId: string): Promise<SavedRequestRecord[]>;

  /**
   * Finds a saved request by id.
   *
   * @param id - Request identifier to look up.
   * @returns Matching request record, or null when not found.
   */
  findRequestById(id: string): Promise<SavedRequestRecord | null>;

  /**
   * Inserts a new request or updates an existing one.
   *
   * @param input - Request fields to persist.
   * @param actingUserId - User performing the save action.
   * @returns The saved request with ID and timestamps.
   */
  saveRequest(input: SaveRequestInput, actingUserId: string): Promise<SavedRequestRecord>;

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  deleteRequest(id: string, actingUserId: string): Promise<void>;

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Folders ordered by sort_order then name.
   */
  listFolders(collectionId: string): Promise<FolderRecord[]>;

  /**
   * Finds a folder by id.
   *
   * @param id - Folder identifier to look up.
   * @returns Matching folder record, or null when not found.
   */
  findFolderById(id: string): Promise<FolderRecord | null>;

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @param actingUserId - User performing the create action.
   * @param parentFolderId - Parent folder, or null/omitted for collection root.
   * @returns The newly created folder.
   */
  createFolder(
    collectionId: string,
    name: string,
    actingUserId: string,
    parentFolderId?: string | null
  ): Promise<FolderRecord>;

  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   * @param actingUserId - User performing the rename action.
   * @param marker - Optional sidebar marker; omit to leave the stored value unchanged.
   * @returns The updated folder.
   */
  renameFolder(
    id: string,
    name: string,
    actingUserId: string,
    marker?: string | null
  ): Promise<FolderRecord>;

  /**
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  deleteFolder(id: string, actingUserId: string): Promise<void>;

  /**
   * Moves a folder to another parent and optionally positions it among siblings.
   *
   * @param id - Folder ID to move.
   * @param parentFolderId - Destination parent, or null for collection root.
   * @param sortOrder - Optional zero-based destination sibling index.
   * @param actingUserId - User performing the move action.
   * @returns The updated folder.
   */
  moveFolder(
    id: string,
    parentFolderId: string | null,
    sortOrder: number | undefined,
    actingUserId: string
  ): Promise<FolderRecord>;

  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param parentFolderId - Parent folder, or null for collection root.
   * @param orderedFolderIds - Folder IDs in desired order.
   * @param actingUserId - User performing the reorder action.
   */
  reorderFolders(
    collectionId: string,
    parentFolderId: string | null,
    orderedFolderIds: string[],
    actingUserId: string
  ): Promise<void>;

  /**
   * Reorders requests within a folder or at collection root.
   *
   * @param collectionId - Collection containing the requests.
   * @param folderId - Folder ID, or null for root-level requests.
   * @param orderedRequestIds - Request IDs in desired order.
   * @param actingUserId - User performing the reorder action.
   */
  reorderRequests(
    collectionId: string,
    folderId: string | null,
    orderedRequestIds: string[],
    actingUserId: string
  ): Promise<void>;

  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param requestId - Request ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   * @param actingUserId - User performing the move action.
   */
  moveRequest(
    requestId: string,
    folderId: string | null,
    index: number,
    actingUserId: string
  ): Promise<void>;

  /**
   * Lists all documents in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Documents ordered by sort_order then name.
   */
  listDocuments(collectionId: string): Promise<DocumentRecord[]>;

  /**
   * Finds a document by id.
   *
   * @param id - Document identifier to look up.
   * @returns Matching document record, or null when not found.
   */
  findDocumentById(id: string): Promise<DocumentRecord | null>;

  /**
   * Inserts a new document or updates an existing one.
   *
   * @param input - Document fields to persist.
   * @param actingUserId - User performing the save action.
   * @returns The saved document with ID and timestamps.
   */
  saveDocument(input: SaveDocumentInput, actingUserId: string): Promise<DocumentRecord>;

  /**
   * Deletes a document by ID.
   *
   * @param id - Document ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  deleteDocument(id: string, actingUserId: string): Promise<void>;

  /**
   * Reorders documents within a folder or at collection root.
   *
   * @param collectionId - Collection containing the documents.
   * @param folderId - Folder ID, or null for root-level documents.
   * @param orderedDocumentIds - Document IDs in desired order.
   * @param actingUserId - User performing the reorder action.
   */
  reorderDocuments(
    collectionId: string,
    folderId: string | null,
    orderedDocumentIds: string[],
    actingUserId: string
  ): Promise<void>;

  /**
   * Moves a document to another folder or collection root at a given index.
   *
   * @param documentId - Document ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   * @param actingUserId - User performing the move action.
   */
  moveDocument(
    documentId: string,
    folderId: string | null,
    index: number,
    actingUserId: string
  ): Promise<void>;

  /**
   * Returns monthly LLM usage for a user, or null when no usage has been recorded.
   *
   * @param userId - Owning user identifier.
   * @param period - UTC calendar month key (`YYYY-MM`).
   */
  getLlmUsage(userId: string, period: string): Promise<LlmUsageRecord | null>;

  /**
   * Atomically increments monthly LLM token usage for a user.
   *
   * @param userId - Owning user identifier.
   * @param period - UTC calendar month key (`YYYY-MM`).
   * @param promptTokens - Prompt tokens to add.
   * @param completionTokens - Completion tokens to add.
   */
  addLlmUsage(
    userId: string,
    period: string,
    promptTokens: number,
    completionTokens: number
  ): Promise<LlmUsageRecord>;

  /**
   * Inserts a per-request LLM usage log entry.
   *
   * @param input - Usage details for one successful completion step.
   */
  createLlmUsageLog(input: CreateLlmUsageLogInput): Promise<LlmUsageLogRecord>;

  /**
   * Lists all per-request LLM usage log entries, newest first.
   */
  listLlmUsageLogs(): Promise<LlmUsageLogRecord[]>;

  /**
   * Lists run results saved by the given user, newest first.
   *
   * @param userId - User account id whose snapshots should be returned.
   */
  listRunResultsForUser(userId: string): Promise<RunResultRecord[]>;

  /**
   * Lists all run results for admin inspection, newest first.
   */
  listAllRunResults(): Promise<RunResultRecord[]>;

  /**
   * Creates a standalone run result snapshot.
   *
   * @param input - Label and HarborClient export payload.
   * @param actingUserId - User performing the save action.
   */
  createRunResult(input: CreateRunResultInput, actingUserId: string): Promise<RunResultRecord>;

  /**
   * Finds a run result by id.
   *
   * @param id - Run result UUID.
   */
  findRunResultById(id: string): Promise<RunResultRecord | null>;

  /**
   * Deletes a run result by id.
   *
   * @param id - Run result UUID.
   * @param actingUserId - User performing the delete action.
   */
  deleteRunResult(id: string, actingUserId: string): Promise<void>;

  /**
   * Creates a discussion comment on a target entity, enforcing tree placement rules.
   *
   * @param input - Target entity, body, and optional parent comment id.
   * @param actingUserId - User creating the comment.
   * @returns The persisted discussion comment record.
   */
  createDiscussionComment(
    input: CreateDiscussionCommentInput,
    actingUserId: string
  ): Promise<DiscussionCommentRecord>;

  /**
   * Lists discussion comments for a target entity with cursor pagination.
   *
   * @param options - Target entity and pagination options.
   * @returns Ordered comments and an optional next-page cursor.
   */
  listDiscussionComments(
    options: ListDiscussionCommentsOptions
  ): Promise<ListDiscussionCommentsResult>;

  /**
   * Finds a discussion comment by id within the current tenant.
   *
   * @param id - Comment identifier to look up.
   * @returns Matching comment record, or null when not found.
   */
  findDiscussionCommentById(id: string): Promise<DiscussionCommentRecord | null>;

  /**
   * Updates the body of an active discussion comment authored by the acting user.
   *
   * @param id - Comment identifier to update.
   * @param input - Replacement body fields.
   * @param actingUserId - User performing the update.
   * @returns Updated discussion comment record.
   */
  updateDiscussionComment(
    id: string,
    input: UpdateDiscussionCommentInput,
    actingUserId: string
  ): Promise<DiscussionCommentRecord>;

  /**
   * Tombstones a discussion comment while preserving child replies.
   *
   * @param id - Comment identifier to tombstone.
   * @param actingUserId - User performing the delete action.
   * @returns Tombstoned discussion comment record.
   */
  tombstoneDiscussionComment(id: string, actingUserId: string): Promise<DiscussionCommentRecord>;

  /**
   * Creates one or more collaboration notices for eligible recipients.
   *
   * No-op when the input array is empty.
   *
   * @param inputs - Notice rows to persist.
   * @returns Created notice records in input order.
   */
  createNotices(inputs: CreateNoticeInput[]): Promise<NoticeRecord[]>;

  /**
   * Lists notices for a recipient with cursor pagination (newest first).
   *
   * @param options - Recipient user id and pagination options.
   * @returns Ordered notices and an optional next-page cursor.
   */
  listNotices(options: ListNoticesOptions): Promise<ListNoticesResult>;

  /**
   * Counts unread notices for a recipient without loading the full feed.
   *
   * @param recipientUserId - User whose unread count is requested.
   * @returns Number of notices with null read timestamps.
   */
  countUnreadNotices(recipientUserId: string): Promise<number>;

  /**
   * Marks one notice read for the authenticated recipient.
   *
   * @param noticeId - Notice identifier to mark read.
   * @param recipientUserId - Recipient user id (must match notice ownership).
   * @returns Updated notice record, or null when not found for the recipient.
   */
  markNoticeRead(noticeId: string, recipientUserId: string): Promise<NoticeRecord | null>;

  /**
   * Marks all unread notices read for a recipient.
   *
   * @param recipientUserId - User whose unread notices should be cleared.
   * @returns Number of notices updated.
   */
  markAllNoticesRead(recipientUserId: string): Promise<number>;

  /**
   * Returns notification settings for a user, defaulting to `all` when unset.
   *
   * @param userId - User account id.
   * @returns Effective notification settings for the user.
   */
  getUserNotificationSettings(userId: string): Promise<UserNotificationSettingsRecord>;

  /**
   * Updates notification settings for a user account.
   *
   * @param userId - User account id.
   * @param level - Replacement notification level.
   * @returns Updated notification settings record.
   */
  updateUserNotificationSettings(
    userId: string,
    level: NotificationLevel
  ): Promise<UserNotificationSettingsRecord>;

  /**
   * Subscribes a user to a discussion thread identified by its root comment id.
   *
   * Idempotent when the subscription already exists.
   *
   * @param userId - User account id.
   * @param rootCommentId - Root comment id for the thread.
   * @returns Persisted subscription record.
   */
  subscribeDiscussionThread(
    userId: string,
    rootCommentId: string
  ): Promise<DiscussionThreadSubscriptionRecord>;

  /**
   * Removes a user's subscription to a discussion thread.
   *
   * @param userId - User account id.
   * @param rootCommentId - Root comment id for the thread.
   */
  unsubscribeDiscussionThread(userId: string, rootCommentId: string): Promise<void>;

  /**
   * Returns true when the user is subscribed to a discussion thread.
   *
   * @param userId - User account id.
   * @param rootCommentId - Root comment id for the thread.
   * @returns True when an active subscription exists.
   */
  isSubscribedToDiscussionThread(userId: string, rootCommentId: string): Promise<boolean>;

  /**
   * Lists user ids subscribed to a discussion thread.
   *
   * @param rootCommentId - Root comment id for the thread.
   * @returns Subscribed user ids for the thread.
   */
  listDiscussionThreadSubscribers(rootCommentId: string): Promise<string[]>;
}
