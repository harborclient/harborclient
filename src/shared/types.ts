/**
 * Supported HTTP request methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/**
 * Request body content type.
 */
export type BodyType = 'none' | 'json' | 'text'

/**
 * A key-value pair with an enable toggle for headers and query params.
 */
export interface KeyValue {
  /**
   * Header or query parameter name.
   */
  key: string

  /**
   * Header or query parameter value.
   */
  value: string

  /**
   * When false, the pair is ignored when building the request.
   */
  enabled: boolean
}

/**
 * A collection-scoped variable for use in request URLs via {{key}} syntax.
 */
export interface Variable {
  /**
   * Variable name referenced in {{key}} placeholders.
   */
  key: string

  /**
   * Value substituted when the variable is resolved.
   */
  value: string
}

/**
 * A named group of saved HTTP requests.
 */
export interface Collection {
  /**
   * Unique database ID.
   */
  id: number

  /**
   * Display name shown in the sidebar.
   */
  name: string

  /**
   * Collection-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[]

  /**
   * ISO 8601 timestamp when the collection was created.
   */
  created_at: string
}

/**
 * A saved HTTP request belonging to a collection.
 */
export interface SavedRequest {
  /**
   * Unique database ID.
   */
  id: number

  /**
   * ID of the collection this request belongs to.
   */
  collection_id: number

  /**
   * Display name shown in the sidebar.
   */
  name: string

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod

  /**
   * Request URL without query parameters.
   */
  url: string

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[]

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[]

  /**
   * Raw request body content.
   */
  body: string

  /**
   * Content type of the request body.
   */
  body_type: BodyType

  /**
   * Position within the collection for sidebar ordering.
   */
  sort_order: number

  /**
   * ISO 8601 timestamp when the request was created.
   */
  created_at: string

  /**
   * ISO 8601 timestamp when the request was last saved.
   */
  updated_at: string
}

/**
 * Portable request shape for collection export/import (no database IDs).
 */
export interface ExportedRequest {
  /**
   * Display name for the saved request.
   */
  name: string

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod

  /**
   * Request URL without query parameters.
   */
  url: string

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[]

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[]

  /**
   * Raw request body content.
   */
  body: string

  /**
   * Content type of the request body.
   */
  body_type: BodyType

  /**
   * Position within the collection for sidebar ordering.
   */
  sort_order: number
}

/**
 * Portable collection export file format.
 */
export interface CollectionExport {
  /**
   * Export schema version for forward compatibility.
   */
  formatVersion: 1

  /**
   * Display name for the collection.
   */
  name: string

  /**
   * Collection-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[]

  /**
   * Saved requests belonging to the collection.
   */
  requests: ExportedRequest[]
}

/**
 * Result of a collection export save-dialog action.
 */
export interface CollectionExportResult {
  /**
   * True when the user canceled the save dialog.
   */
  canceled: boolean

  /**
   * Absolute path where the file was written; omitted when canceled.
   */
  path?: string
}

/**
 * Input for creating or updating a saved request.
 */
export interface SaveRequestInput {
  /**
   * Existing request ID; omit to insert a new request.
   */
  id?: number

  /**
   * ID of the collection to save the request in.
   */
  collection_id: number

  /**
   * Display name for the saved request.
   */
  name: string

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod

  /**
   * Request URL without query parameters.
   */
  url: string

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[]

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[]

  /**
   * Raw request body content.
   */
  body: string

  /**
   * Content type of the request body.
   */
  body_type: BodyType
}

/**
 * Input for sending an HTTP request from the renderer.
 */
export interface SendRequestInput {
  /**
   * HTTP method to use for the request.
   */
  method: HttpMethod

  /**
   * Request URL without query parameters.
   */
  url: string

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[]

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[]

  /**
   * Raw request body content.
   */
  body: string

  /**
   * Content type of the request body.
   */
  bodyType: BodyType
}

/**
 * Result of an HTTP request including timing and size metadata.
 */
export interface SendResult {
  /**
   * HTTP status code, or 0 when the request failed before a response.
   */
  status: number

  /**
   * HTTP status text from the response.
   */
  statusText: string

  /**
   * Response headers as a flat key-value map.
   */
  headers: Record<string, string>

  /**
   * Response body as text.
   */
  body: string

  /**
   * Round-trip time in milliseconds.
   */
  timeMs: number

  /**
   * Response body size in bytes.
   */
  sizeBytes: number

  /**
   * Error message when the request failed; omitted on success.
   */
  error?: string
}

/**
 * IPC bridge API exposed to the renderer via contextBridge.
 */
export interface Api {
  /**
   * Lists all collections.
   *
   * @returns All collections from the main process.
   */
  listCollections: () => Promise<Collection[]>

  /**
   * Creates a new collection.
   *
   * @param name - Display name for the collection.
   * @returns The newly created collection.
   */
  createCollection: (name: string) => Promise<Collection>

  /**
   * Updates a collection's name and variables.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @returns The updated collection.
   */
  updateCollection: (id: number, name: string, variables: Variable[]) => Promise<Collection>

  /**
   * Deletes a collection and all of its saved requests.
   *
   * @param id - Collection ID to delete.
   */
  deleteCollection: (id: number) => Promise<void>

  /**
   * Exports a collection to a JSON file via a native save dialog.
   *
   * @param id - Collection ID to export.
   * @returns Whether the dialog was canceled and the saved path when written.
   */
  exportCollection: (id: number) => Promise<CollectionExportResult>

  /**
   * Imports a collection from a JSON file via a native open dialog.
   *
   * @returns The imported collection, or null when the dialog was canceled.
   */
  importCollection: () => Promise<Collection | null>

  /**
   * Lists saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests in the collection.
   */
  listRequests: (collectionId: number) => Promise<SavedRequest[]>

  /**
   * Inserts a new saved request or updates an existing one.
   *
   * @param req - Request fields to persist.
   * @returns The saved request.
   */
  saveRequest: (req: SaveRequestInput) => Promise<SavedRequest>

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  deleteRequest: (id: number) => Promise<void>

  /**
   * Sends an HTTP request via the main process.
   *
   * @param req - Request configuration to execute.
   * @returns Response metadata from the main process.
   */
  sendRequest: (req: SendRequestInput) => Promise<SendResult>
}

declare global {
  /**
   * Extends Window with the preload-exposed API.
   */
  interface Window {
    /**
     * IPC bridge for collections, saved requests, and HTTP execution.
     */
    api: Api
  }
}
