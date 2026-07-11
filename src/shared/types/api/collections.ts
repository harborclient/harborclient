import type { AuthConfig } from '#/shared/auth';
import type {
  RunResultsExport,
  SavedRunResult,
  SavedRunResultSummary,
  SaveRunResultInput
} from '#/shared/collectionRunner';
import type {
  Collection,
  CollectionExportResult,
  Folder,
  ImportEntityResult,
  ListCollectionsResult
} from '#/shared/types/collection';
import type { RequestExport } from '#/shared/types/request';
import type { Environment } from '#/shared/types/environment';
import type { KeyValue, Variable } from '#/shared/types/common';
import type { ScriptRef } from '#/shared/types/script';
import type { SavedRequest } from '#/shared/types/request';

/**
 * IPC methods for collections.
 */
export interface ApiCollections {
  /**
   * Lists all collections.
   *
   * @returns Collections and any warnings when backends were unavailable.
   */
  listCollections: () => Promise<ListCollectionsResult>;
  /**
   * Creates a new collection.
   *
   * @param name - Display name for the collection.
   * @param connectionId - Optional provider id; defaults to the active database.
   * @returns The newly created collection.
   */
  createCollection: (name: string, connectionId?: string) => Promise<Collection>;
  /**
   * Updates a collection's name, variables, headers, and auth settings.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Collection pre-request script.
   * @param postRequestScript - Collection post-request script.
   * @param auth - Default Authorization settings for requests in the collection.
   * @returns The updated collection.
   */
  updateCollection: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    preRequestScripts?: ScriptRef[],
    postRequestScripts?: ScriptRef[]
  ) => Promise<Collection>;
  /**
   * Deletes a collection and all of its saved requests.
   *
   * @param id - Collection ID to delete.
   */
  deleteCollection: (id: number) => Promise<void>;
  /**
   * Deep-copies a collection into a new collection on the same backend.
   *
   * @param id - Global collection ID to duplicate.
   * @returns The newly created collection.
   */
  duplicateCollection: (id: number) => Promise<Collection>;
  /**
   * Exports a collection to a JSON file via a native save dialog.
   *
   * @param id - Collection ID to export.
   * @returns Whether the dialog was canceled and the saved path when written.
   */
  exportCollection: (id: number) => Promise<CollectionExportResult>;
  /**
   * Imports a collection from a JSON file via a native open dialog.
   *
   * @returns The imported collection, or null when the dialog was canceled.
   */
  importCollection: () => Promise<Collection | null>;
  /**
   * Exports a request to a JSON file via a native save dialog.
   *
   * @param data - Portable request export payload.
   * @returns Whether the dialog was canceled and the saved path when written.
   */
  exportRequest: (data: RequestExport) => Promise<CollectionExportResult>;
  /**
   * Imports a request from a JSON file via a native open dialog.
   *
   * @param collectionId - Collection to add the imported request to.
   * @param folderId - Target folder id, or omitted/null for collection root.
   * @returns The imported request, or null when the dialog was canceled.
   */
  importRequest: (collectionId: number, folderId?: number | null) => Promise<SavedRequest | null>;
  /**
   * Exports run results to a JSON file via a native save dialog.
   *
   * @param data - Portable run-results export payload.
   * @returns Whether the dialog was canceled and the saved path when written.
   */
  exportRunResults: (data: RunResultsExport) => Promise<CollectionExportResult>;
  /**
   * Imports run results from a JSON file via a native open dialog.
   *
   * @returns Parsed run-results export, or null when the dialog was canceled.
   */
  importRunResults: () => Promise<RunResultsExport | null>;
  /**
   * Lists saved run result snapshots from all storage providers.
   */
  listSavedRunResults: () => Promise<SavedRunResultSummary[]>;
  /**
   * Saves a run result snapshot to the chosen storage provider.
   *
   * @param connectionId - Database connection or team hub id.
   * @param input - Label and portable export payload.
   */
  saveRunResult: (connectionId: string, input: SaveRunResultInput) => Promise<SavedRunResult>;
  /**
   * Loads a saved run result snapshot by routed global id.
   *
   * @param id - Global run result id.
   */
  getSavedRunResult: (id: number) => Promise<SavedRunResult | null>;
  /**
   * Deletes a saved run result snapshot.
   *
   * @param id - Global run result id.
   */
  deleteSavedRunResult: (id: number) => Promise<void>;
  /**
   * Resolves a run result UUID across mounted Team Hub providers.
   *
   * @param uuid - Stable portable run result identifier.
   */
  resolveRunResultByUuid: (uuid: string) => Promise<SavedRunResult | null>;
  /**
   * Exports an environment to a JSON file via a native save dialog.
   *
   * @param id - Environment ID to export.
   * @returns Whether the dialog was canceled and the saved path when written.
   */
  exportEnvironment: (id: number) => Promise<CollectionExportResult>;
  /**
   * Imports an environment from a JSON file via a native open dialog.
   *
   * @returns The imported environment, or null when the dialog was canceled.
   */
  importEnvironment: () => Promise<Environment | null>;
  /**
   * Imports a collection, request, or environment from a JSON file via File -> Import.
   *
   * @param activeCollectionId - Selected collection id; required when importing a request.
   * @param pluginExtensions - Additional file extensions registered by enabled plugins.
   * @returns The imported entity, or null when the dialog was canceled.
   */
  importEntity: (
    activeCollectionId: number | null,
    pluginExtensions?: string[]
  ) => Promise<ImportEntityResult | null>;
  /**
   * Moves a collection and its requests to another database connection.
   *
   * @param id - Global collection ID to move.
   * @param targetConnectionId - Destination connection id.
   * @returns The collection in its new backend with a new global id.
   */
  moveCollection: (id: number, targetConnectionId: string) => Promise<Collection>;
  /**
   * Reorders collections in the sidebar.
   *
   * @param orderedCollectionIds - Global collection ids in desired order.
   */
  reorderCollections: (orderedCollectionIds: number[]) => Promise<void>;
  /**
   * Lists folders in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Folders ordered by sort_order then name.
   */
  listFolders: (collectionId: number) => Promise<Folder[]>;
  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @returns The newly created folder.
   */
  createFolder: (collectionId: number, name: string) => Promise<Folder>;
  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   * @returns The updated folder.
   */
  renameFolder: (id: number, name: string) => Promise<Folder>;
  /**
   * Updates a folder's name, variables, headers, auth, and scripts.
   *
   * @param id - Folder ID to update.
   * @param name - New display name.
   * @param variables - Folder-scoped variables.
   * @param headers - Headers sent with every request in the folder.
   * @param preRequestScript - Folder pre-request script.
   * @param postRequestScript - Folder post-request script.
   * @param auth - Default Authorization settings for requests in the folder.
   * @returns The updated folder.
   */
  updateFolder: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    preRequestScripts?: ScriptRef[],
    postRequestScripts?: ScriptRef[]
  ) => Promise<Folder>;
  /**
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   */
  deleteFolder: (id: number) => Promise<void>;
  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param orderedFolderIds - Folder IDs in desired order.
   */
  reorderFolders: (collectionId: number, orderedFolderIds: number[]) => Promise<void>;
  /**
   * Reorders requests within a folder or at collection root.
   *
   * @param collectionId - Collection containing the requests.
   * @param folderId - Folder ID, or null for root-level requests.
   * @param orderedRequestIds - Request IDs in desired order.
   */
  reorderRequests: (
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ) => Promise<void>;
  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param requestId - Request ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  moveRequest: (requestId: number, folderId: number | null, index: number) => Promise<void>;
}
