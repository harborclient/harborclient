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
   * Renames an existing collection.
   *
   * @param id - Collection ID to rename.
   * @param name - New display name.
   * @returns The updated collection.
   */
  renameCollection: (id: number, name: string) => Promise<Collection>

  /**
   * Deletes a collection and all of its saved requests.
   *
   * @param id - Collection ID to delete.
   */
  deleteCollection: (id: number) => Promise<void>

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
