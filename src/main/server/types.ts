import type { AuthConfig, BodyType, HttpMethod, KeyValue, Variable } from '#/shared/types';

/**
 * Connection settings for {@link HarborServerClient}.
 */
export interface ServerClientConfig {
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
