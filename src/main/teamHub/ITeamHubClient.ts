import type {
  AdminResourceOption,
  CollectionRecord,
  CreateCollectionInput,
  CreateEnvironmentInput,
  CreateFolderInput,
  CreateRequestInput,
  EnvironmentRecord,
  FolderRecord,
  HealthResponse,
  HubUserRecord,
  MoveRequestInput,
  RenameFolderInput,
  ReorderFoldersInput,
  ReorderRequestsInput,
  SavedRequestRecord,
  SessionResponse,
  TeamHubAdminResourceOptions,
  UpdateCollectionInput,
  UpdateEnvironmentInput,
  UpdateHubUserInput,
  CreateHubUserInput,
  HubApiTokenRecord,
  CreatedHubUser,
  CreateHubTokenInput,
  CreatedHubToken,
  UpdateRequestInput
} from '#/main/teamHub/types';
import type { HubLlmModel } from '#/shared/types';

/**
 * Typed HTTP client for HarborClient Server entity and health routes.
 */
export interface ITeamHubClient {
  /**
   * Probes server availability via the public health endpoint.
   */
  checkHealth(): Promise<HealthResponse>;

  /**
   * Returns the authenticated user, token metadata, and derived API capabilities.
   *
   * Calls `GET /auth/session` with bearer auth. Use this to discover whether
   * a token belongs to a `user` or `admin` account before gating management UI.
   */
  getSession(): Promise<SessionResponse>;

  /**
   * Lists all Team Hub user accounts visible to an admin-role token.
   */
  listAdminUsers(): Promise<HubUserRecord[]>;

  /**
   * Creates a Team Hub user account and an initial API bearer token.
   *
   * @param input - User fields for the new account.
   */
  createAdminUser(input: CreateHubUserInput): Promise<CreatedHubUser>;

  /**
   * Updates a Team Hub user account via the management API.
   *
   * @param id - User account identifier.
   * @param input - Partial user fields to apply.
   */
  updateAdminUser(id: string, input: UpdateHubUserInput): Promise<HubUserRecord>;

  /**
   * Deletes a Team Hub user account and their API tokens via the management API.
   *
   * @param id - User account identifier.
   */
  deleteAdminUser(id: string): Promise<void>;

  /**
   * Lists all API bearer tokens visible to an admin-role token.
   */
  listAdminTokens(): Promise<HubApiTokenRecord[]>;

  /**
   * Creates an additional API bearer token for a user account.
   *
   * @param userId - Owning user account identifier.
   * @param input - Human-readable label for the new token.
   */
  createAdminUserToken(userId: string, input: CreateHubTokenInput): Promise<CreatedHubToken>;

  /**
   * Permanently deletes an API bearer token via the management API.
   *
   * @param id - Token record identifier.
   */
  deleteAdminToken(id: string): Promise<void>;

  /**
   * Lists all collections as id/name metadata for admin user management.
   */
  listAdminCollections(): Promise<AdminResourceOption[]>;

  /**
   * Lists all environments as id/name metadata for admin user management.
   */
  listAdminEnvironments(): Promise<AdminResourceOption[]>;

  /**
   * Lists all hub-offered LLM models for admin user management.
   */
  listAdminLlmModels(): Promise<HubLlmModel[]>;

  /**
   * Loads collection, environment, and LLM model options for admin user forms.
   */
  listAdminResourceOptions(): Promise<TeamHubAdminResourceOptions>;

  /**
   * Lists all collections visible to the authenticated token.
   */
  listCollections(): Promise<CollectionRecord[]>;

  /**
   * Creates a new top-level collection.
   *
   * @param input - Display name for the collection.
   */
  createCollection(input: CreateCollectionInput): Promise<CollectionRecord>;

  /**
   * Updates an existing collection's settings.
   *
   * @param id - Collection UUID.
   * @param input - Updated collection fields.
   */
  updateCollection(id: string, input: UpdateCollectionInput): Promise<CollectionRecord>;

  /**
   * Deletes a collection and all nested folders and requests.
   *
   * @param id - Collection UUID.
   */
  deleteCollection(id: string): Promise<void>;

  /**
   * Lists all environments visible to the authenticated token.
   */
  listEnvironments(): Promise<EnvironmentRecord[]>;

  /**
   * Creates a new top-level environment.
   *
   * @param input - Display name for the environment.
   */
  createEnvironment(input: CreateEnvironmentInput): Promise<EnvironmentRecord>;

  /**
   * Updates an existing environment's name and variables.
   *
   * @param id - Environment UUID.
   * @param input - Updated environment fields.
   */
  updateEnvironment(id: string, input: UpdateEnvironmentInput): Promise<EnvironmentRecord>;

  /**
   * Deletes an environment by id.
   *
   * @param id - Environment UUID.
   */
  deleteEnvironment(id: string): Promise<void>;

  /**
   * Lists folders in a collection ordered by sort order, then name.
   *
   * @param collectionId - Parent collection UUID.
   */
  listFolders(collectionId: string): Promise<FolderRecord[]>;

  /**
   * Creates a folder in the given collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Display name for the folder.
   */
  createFolder(collectionId: string, input: CreateFolderInput): Promise<FolderRecord>;

  /**
   * Renames a folder by id.
   *
   * @param id - Folder UUID.
   * @param input - Updated folder name.
   */
  renameFolder(id: string, input: RenameFolderInput): Promise<FolderRecord>;

  /**
   * Deletes a folder and all saved requests inside it.
   *
   * @param id - Folder UUID.
   */
  deleteFolder(id: string): Promise<void>;

  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Folder ids in the desired order.
   */
  reorderFolders(collectionId: string, input: ReorderFoldersInput): Promise<void>;

  /**
   * Lists saved requests in a collection.
   *
   * @param collectionId - Parent collection UUID.
   */
  listRequests(collectionId: string): Promise<SavedRequestRecord[]>;

  /**
   * Creates a new saved request in a collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Saved request fields.
   */
  createRequest(collectionId: string, input: CreateRequestInput): Promise<SavedRequestRecord>;

  /**
   * Updates an existing saved request by id.
   *
   * @param id - Saved request UUID.
   * @param input - Updated request fields including collection id.
   */
  updateRequest(id: string, input: UpdateRequestInput): Promise<SavedRequestRecord>;

  /**
   * Deletes a saved request by id.
   *
   * @param id - Saved request UUID.
   */
  deleteRequest(id: string): Promise<void>;

  /**
   * Reorders saved requests within a folder or the collection root.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Destination folder and ordered request ids.
   */
  reorderRequests(collectionId: string, input: ReorderRequestsInput): Promise<void>;

  /**
   * Moves a saved request to another folder or root index.
   *
   * @param id - Saved request UUID.
   * @param input - Destination folder and target index.
   */
  moveRequest(id: string, input: MoveRequestInput): Promise<void>;
}
