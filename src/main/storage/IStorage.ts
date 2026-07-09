import type {
  ProviderRunResult,
  ProviderRunResultSummary,
  SaveRunResultInput
} from '#/shared/collectionRunner';
import type { SnippetScope } from '#/shared/snippetScope';
import type { ScriptStage } from '@harborclient/sdk';
import type {
  AuthConfig,
  Collection,
  CollectionExport,
  Environment,
  Folder,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  SourceControlStatus,
  Variable
} from '#/shared/types';

/**
 * Contract for persistent storage of collections, requests, and app settings.
 */
export interface IStorage {
  /**
   * Opens the database connection using constructor configuration.
   */
  init(): Promise<void>;

  /**
   * Lists all collections ordered by name.
   *
   * @returns All collections in the database.
   */
  listCollections(): Promise<Collection[]>;

  /**
   * Creates a new collection with the given name.
   *
   * @param name - Display name for the collection.
   * @returns The newly created collection.
   */
  createCollection(name: string): Promise<Collection>;

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
   * @param preRequestScripts - Ordered collection pre-request script references.
   * @param postRequestScripts - Ordered collection post-request script references.
   * @returns The updated collection.
   */
  updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    preRequestScripts?: ScriptRef[],
    postRequestScripts?: ScriptRef[]
  ): Promise<Collection>;

  /**
   * Deletes a collection and all of its requests.
   *
   * @param id - Collection ID to delete.
   */
  deleteCollection(id: number): Promise<void>;

  /**
   * Lists all environments ordered by name.
   *
   * @returns All environments in the database.
   */
  listEnvironments(): Promise<Environment[]>;

  /**
   * Creates a new environment with the given name.
   *
   * @param name - Display name for the environment.
   * @param uuid - Optional stable identifier; generated when omitted.
   * @returns The newly created environment.
   */
  createEnvironment(name: string, uuid?: string): Promise<Environment>;

  /**
   * Updates an environment's name and variables.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @returns The updated environment.
   */
  updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment>;

  /**
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   */
  deleteEnvironment(id: number): Promise<void>;

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests ordered by sort_order then name.
   */
  listRequests(collectionId: number): Promise<SavedRequest[]>;

  /**
   * Inserts a new request or updates an existing one.
   *
   * @param input - Request fields to persist.
   * @returns The saved request with ID and timestamps.
   */
  saveRequest(input: SaveRequestInput): Promise<SavedRequest>;

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  deleteRequest(id: number): Promise<void>;

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Folders ordered by sort_order then name.
   */
  listFolders(collectionId: number): Promise<Folder[]>;

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @returns The newly created folder.
   */
  createFolder(collectionId: number, name: string): Promise<Folder>;

  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   * @returns The updated folder.
   */
  renameFolder(id: number, name: string): Promise<Folder>;

  /**
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   */
  deleteFolder(id: number): Promise<void>;

  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param orderedFolderIds - Folder IDs in desired order.
   */
  reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void>;

  /**
   * Reorders requests within a folder or at collection root.
   *
   * @param collectionId - Collection containing the requests.
   * @param folderId - Folder ID, or null for root-level requests.
   * @param orderedRequestIds - Request IDs in desired order.
   */
  reorderRequests(
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ): Promise<void>;

  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param requestId - Request ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  moveRequest(requestId: number, folderId: number | null, index: number): Promise<void>;

  /**
   * Builds a portable export payload for a collection and its requests.
   *
   * @param id - Collection ID to export.
   * @returns Collection export data without database IDs.
   */
  exportCollectionData(id: number): Promise<CollectionExport>;

  /**
   * Imports a collection and its requests from export data.
   *
   * @param data - Parsed collection export payload.
   * @returns The newly created collection.
   */
  importCollectionData(data: unknown): Promise<Collection>;

  /**
   * Looks up a collection by its portable uuid within this provider store.
   *
   * @param uuid - Stable collection identifier.
   * @returns The collection when found, otherwise null.
   */
  findCollectionByUuid(uuid: string): Promise<Collection | null>;

  /**
   * Looks up a request by uuid within a collection in this provider store.
   *
   * @param collectionId - Provider-local collection id.
   * @param uuid - Stable request identifier.
   * @returns The request when found, otherwise null.
   */
  findRequestByUuid(collectionId: number, uuid: string): Promise<SavedRequest | null>;

  /**
   * Updates an existing collection and upserts folders/requests from import data.
   *
   * Existing requests not present in the file are left unchanged.
   *
   * @param id - Provider-local collection id to update.
   * @param data - Validated collection export payload.
   * @returns The updated collection.
   */
  updateCollectionFromImport(id: number, data: CollectionExport): Promise<Collection>;

  /**
   * Returns the working-tree source-control status for this provider.
   *
   * Only git-backed storage implements this; other providers return null.
   *
   * @returns Branch, sync, and change counts when supported, otherwise null.
   */
  getSourceControlStatus(): Promise<SourceControlStatus | null>;

  /**
   * Reads a persisted setting by key.
   *
   * @param key - Setting key to look up.
   * @returns The stored value, or undefined when not set.
   */
  getSetting(key: string): Promise<string | undefined>;

  /**
   * Persists a setting value, replacing any existing entry for the key.
   *
   * @param key - Setting key to store.
   * @param value - Value to persist.
   */
  setSetting(key: string, value: string): Promise<void>;

  /**
   * Closes the database connection.
   */
  close(): Promise<void>;

  /**
   * Lists all snippets stored in this provider ordered for display.
   *
   * @returns Provider-local snippet records.
   */
  listSnippets(): Promise<Snippet[]>;

  /**
   * Creates a new snippet in this provider.
   *
   * @param name - Display name for the snippet.
   * @param code - JavaScript source.
   * @param scope - Script phases where the snippet may be referenced.
   * @param uuid - Optional stable identifier; generated when omitted.
   * @returns The newly created provider-local snippet.
   */
  createSnippet(
    name: string,
    code: string,
    scope: SnippetScope,
    stage?: ScriptStage,
    uuid?: string
  ): Promise<Snippet>;

  /**
   * Updates a snippet's name, code, scope, and stage in this provider.
   *
   * @param id - Provider-local snippet id.
   * @param name - New display name.
   * @param code - Updated JavaScript source.
   * @param scope - Script phases where the snippet may be referenced.
   * @param stage - Default stage when added to a script list.
   * @returns The updated provider-local snippet.
   */
  updateSnippet(
    id: number,
    name: string,
    code: string,
    scope: SnippetScope,
    stage?: ScriptStage
  ): Promise<Snippet>;

  /**
   * Deletes a snippet from this provider.
   *
   * @param id - Provider-local snippet id.
   */
  deleteSnippet(id: number): Promise<void>;

  /**
   * Lists persisted run result snapshots ordered for display.
   *
   * @returns Provider-local run result summaries without payload bodies.
   */
  listRunResults(): Promise<ProviderRunResultSummary[]>;

  /**
   * Saves a run result snapshot to this provider.
   *
   * @param input - Display label override and portable export payload.
   * @returns The newly persisted provider-local run result.
   */
  saveRunResult(input: SaveRunResultInput): Promise<ProviderRunResult>;

  /**
   * Loads a run result snapshot by provider-local id.
   *
   * @param id - Provider-local run result id.
   * @returns Full run result when found, otherwise null.
   */
  getRunResult(id: number): Promise<ProviderRunResult | null>;

  /**
   * Deletes a run result snapshot from this provider.
   *
   * @param id - Provider-local run result id.
   */
  deleteRunResult(id: number): Promise<void>;
}
