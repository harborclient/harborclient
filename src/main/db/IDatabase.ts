import type {
  Collection,
  CollectionExport,
  Environment,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  Variable
} from '#/shared/types';

/**
 * Contract for persistent storage of collections, requests, and app settings.
 */
export interface IDatabase {
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
   * @returns The updated collection.
   */
  updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string
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
   * @returns The newly created environment.
   */
  createEnvironment(name: string): Promise<Environment>;

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
}
