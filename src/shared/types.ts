/**
 * Supported HTTP request methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Request body content type.
 */
export type BodyType = 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';

/**
 * Field type for a multipart/form-data part.
 */
export type FormDataPartType = 'text' | 'file';

/**
 * A single part in a multipart/form-data body.
 */
export interface FormDataPart {
  /**
   * Form field name.
   */
  key: string;

  /**
   * Text value when type is text; ignored for file parts.
   */
  value: string;

  /**
   * When false, the part is excluded when building the request.
   */
  enabled: boolean;

  /**
   * Whether this part is a text field or file upload.
   */
  type: FormDataPartType;

  /**
   * Absolute file paths for file parts; supports one or more files per field.
   */
  files: string[];
}

/**
 * A key-value pair with an enable toggle for headers and query params.
 */
export interface KeyValue {
  /**
   * Header or query parameter name.
   */
  key: string;

  /**
   * Header or query parameter value.
   */
  value: string;

  /**
   * When false, the pair is ignored when building the request.
   */
  enabled: boolean;
}

/**
 * A collection-scoped variable for use in request URLs via {{key}} syntax.
 */
export interface Variable {
  /**
   * Variable name referenced in {{key}} placeholders.
   */
  key: string;

  /**
   * Value substituted when the variable is resolved.
   */
  value: string;

  /**
   * Fallback value used when value is empty.
   */
  defaultValue: string;

  /**
   * When true, value is included in collection exports.
   */
  share: boolean;
}

/**
 * A named group of variables available when the environment is active.
 */
export interface Environment {
  /**
   * Unique database ID.
   */
  id: number;

  /**
   * Display name shown in the sidebar and TabBar dropdown.
   */
  name: string;

  /**
   * Environment-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];

  /**
   * ISO 8601 timestamp when the environment was created.
   */
  created_at: string;
}

/**
 * A named group of saved HTTP requests.
 */
export interface Collection {
  /**
   * Unique database ID.
   */
  id: number;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Collection-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];

  /**
   * Headers sent with every request in this collection.
   */
  headers: KeyValue[];

  /**
   * JavaScript run before every request in this collection (before request-level pre script).
   */
  pre_request_script: string;

  /**
   * JavaScript run after every request in this collection (after request-level post script).
   */
  post_request_script: string;

  /**
   * ISO 8601 timestamp when the collection was created.
   */
  created_at: string;

  /**
   * Id of the database connection that stores this collection.
   */
  connectionId?: string;
}

/**
 * A folder for organizing requests within a collection (single level).
 */
export interface Folder {
  /**
   * Unique database ID.
   */
  id: number;

  /**
   * ID of the collection this folder belongs to.
   */
  collection_id: number;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Position among sibling folders for sidebar ordering.
   */
  sort_order: number;

  /**
   * ISO 8601 timestamp when the folder was created.
   */
  created_at: string;
}

/**
 * A saved HTTP request belonging to a collection.
 */
export interface SavedRequest {
  /**
   * Unique database ID.
   */
  id: number;

  /**
   * ID of the collection this request belongs to.
   */
  collection_id: number;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  body_type: BodyType;

  /**
   * JavaScript run before the request is sent.
   */
  pre_request_script: string;

  /**
   * JavaScript run after the response is received.
   */
  post_request_script: string;

  /**
   * Free-form notes for this request.
   */
  comment: string;

  /**
   * ID of the folder containing this request, or null when at collection root.
   */
  folder_id: number | null;

  /**
   * Position within the collection for sidebar ordering.
   */
  sort_order: number;

  /**
   * ISO 8601 timestamp when the request was created.
   */
  created_at: string;

  /**
   * ISO 8601 timestamp when the request was last saved.
   */
  updated_at: string;
}

/**
 * Portable request shape for collection export/import (no database IDs).
 */
export interface ExportedRequest {
  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  body_type: BodyType;

  /**
   * JavaScript run before the request is sent.
   */
  pre_request_script: string;

  /**
   * JavaScript run after the response is received.
   */
  post_request_script: string;

  /**
   * Free-form notes for this request.
   */
  comment: string;

  /**
   * Position within the collection for sidebar ordering.
   */
  sort_order: number;

  /**
   * Name of the folder containing this request; null or omitted for collection root.
   */
  folder_name?: string | null;
}

/**
 * Portable folder shape for collection export/import (no database IDs).
 */
export interface ExportedFolder {
  /**
   * Display name for the folder.
   */
  name: string;

  /**
   * Position among sibling folders for sidebar ordering.
   */
  sort_order: number;
}

/**
 * Portable collection export file format.
 */
export interface CollectionExport {
  /**
   * Export schema version for forward compatibility.
   */
  formatVersion: 1 | 2;

  /**
   * Display name for the collection.
   */
  name: string;

  /**
   * Collection-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];

  /**
   * Headers sent with every request in this collection.
   */
  headers: KeyValue[];

  /**
   * JavaScript run before every request in this collection.
   */
  pre_request_script: string;

  /**
   * JavaScript run after every request in this collection.
   */
  post_request_script: string;

  /**
   * Folders for organizing requests; present in format version 2 exports.
   */
  folders?: ExportedFolder[];

  /**
   * Saved requests belonging to the collection.
   */
  requests: ExportedRequest[];
}

/**
 * Result of a collection export save-dialog action.
 */
export interface CollectionExportResult {
  /**
   * True when the user canceled the save dialog.
   */
  canceled: boolean;

  /**
   * Absolute path where the file was written; omitted when canceled.
   */
  path?: string;
}

/**
 * Input for creating or updating a saved request.
 */
export interface SaveRequestInput {
  /**
   * Existing request ID; omit to insert a new request.
   */
  id?: number;

  /**
   * ID of the collection to save the request in.
   */
  collection_id: number;

  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  body_type: BodyType;

  /**
   * JavaScript run before the request is sent.
   */
  pre_request_script: string;

  /**
   * JavaScript run after the response is received.
   */
  post_request_script: string;

  /**
   * Free-form notes for this request.
   */
  comment: string;

  /**
   * ID of the folder containing this request, or null when at collection root.
   */
  folder_id?: number | null;
}

/**
 * Input for sending an HTTP request from the renderer.
 */
export interface SendRequestInput {
  /**
   * HTTP method to use for the request.
   */
  method: HttpMethod;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  bodyType: BodyType;
}

/**
 * Metadata for the HTTP request as sent. Multipart {@link body} is a display
 * summary of form fields, not the raw wire payload.
 */
export interface SentRequest {
  /**
   * HTTP method used for the request.
   */
  method: HttpMethod;

  /**
   * Fully resolved request URL including query parameters.
   */
  url: string;

  /**
   * Request headers as a flat key-value map.
   */
  headers: Record<string, string>;

  /**
   * Body content for display. For multipart, a human-readable summary of form
   * fields and file names — not the raw multipart bytes. For other body types,
   * the literal string sent on the wire, or empty when none.
   */
  body: string;

  /**
   * Content type of the request body; used to interpret {@link body}.
   */
  bodyType?: BodyType;
}

/**
 * Result of an HTTP request including timing and size metadata.
 */
export interface SendResult {
  /**
   * HTTP status code, or 0 when the request failed before a response.
   */
  status: number;

  /**
   * HTTP status text from the response.
   */
  statusText: string;

  /**
   * Response headers as a flat key-value map.
   */
  headers: Record<string, string>;

  /**
   * Response body as text.
   */
  body: string;

  /**
   * Round-trip time in milliseconds.
   */
  timeMs: number;

  /**
   * Response body size in bytes.
   */
  sizeBytes: number;

  /**
   * Error message when the request failed; omitted on success.
   */
  error?: string;

  /**
   * Set-Cookie header values from the response; used by the cookie jar.
   */
  setCookieHeaders?: string[];

  /**
   * The outgoing request as actually sent; omitted on older results.
   */
  request?: SentRequest;
}

/**
 * Script execution phase relative to the HTTP request.
 */
export type ScriptPhase = 'pre' | 'post';

/**
 * Request context passed into a pre/post script sandbox.
 */
export interface ScriptRequestContext {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: BodyType;
}

/**
 * Input for running a pre/post script in the main process sandbox.
 */
export interface ScriptRunInput {
  phase: ScriptPhase;
  script: string;
  request: ScriptRequestContext;
  response?: SendResult;
  variables: Record<string, string>;
}

/**
 * Result of a single hc.test assertion.
 */
export interface ScriptTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

/**
 * Result returned from the script sandbox after execution.
 */
export interface ScriptRunResult {
  request: ScriptRequestContext;
  variableSets: Record<string, string>;
  tests: ScriptTestResult[];
  logs: string[];
  error?: string;
}

/**
 * Theme preference for light, dark, or system appearance.
 */
export type ThemeSource = 'light' | 'dark' | 'system';

/**
 * Active database backend for collections and requests.
 */
export type DatabaseProvider = 'sqlite' | 'firestore' | 'mysql' | 'postgres';

/**
 * Request editor tab identifiers.
 */
export type EditorTab = 'params' | 'headers' | 'cookies' | 'body' | 'pre' | 'post' | 'comment';

/**
 * General application settings for HTTP request execution.
 */
export interface GeneralSettings {
  /**
   * Request timeout in milliseconds; 0 disables the timeout.
   */
  requestTimeoutMs: number;

  /**
   * Maximum response body size in megabytes; 0 disables the limit.
   */
  maxResponseSizeMb: number;

  /**
   * When true, TLS certificates are verified for HTTPS requests.
   */
  verifySsl: boolean;
}

/**
 * Firebase Firestore connection settings.
 */
export interface FirestoreSettings {
  /**
   * Firebase Web API key.
   */
  apiKey: string;

  /**
   * Firebase Auth domain.
   */
  authDomain: string;

  /**
   * Firebase project ID.
   */
  projectId: string;

  /**
   * Firebase app ID.
   */
  appId: string;

  /**
   * Email for Firebase Auth sign-in.
   */
  email: string;

  /**
   * Password for Firebase Auth sign-in.
   */
  password: string;
}

/**
 * MySQL connection settings.
 */
export interface MySqlSettings {
  /**
   * MySQL server hostname.
   */
  host: string;

  /**
   * MySQL server port.
   */
  port: number;

  /**
   * MySQL username.
   */
  user: string;

  /**
   * MySQL password.
   */
  password: string;

  /**
   * MySQL database name.
   */
  database: string;
}

/**
 * PostgreSQL connection settings.
 */
export interface PostgresSettings {
  /**
   * PostgreSQL server hostname.
   */
  host: string;

  /**
   * PostgreSQL server port.
   */
  port: number;

  /**
   * PostgreSQL username.
   */
  user: string;

  /**
   * PostgreSQL password.
   */
  password: string;

  /**
   * PostgreSQL database name.
   */
  database: string;
}

/**
 * Configurable SQLite database path and legacy migration settings.
 */
export interface SqliteSettings {
  /**
   * Filename of the primary database file within userData.
   */
  dbFilename: string;

  /**
   * Filename of the legacy database file used for migration.
   */
  legacyDbFilename: string;

  /**
   * Legacy application data directory name under appData.
   */
  legacyUserDataDir: string;
}

/**
 * Shared fields for a named database connection.
 */
export interface DatabaseConnectionBase {
  /**
   * Unique connection identifier.
   */
  id: string;

  /**
   * User-defined display name.
   */
  name: string;
}

/**
 * A named database connection with type-specific settings.
 */
export type DatabaseConnection =
  | (DatabaseConnectionBase & { type: 'sqlite'; settings: SqliteSettings })
  | (DatabaseConnectionBase & { type: 'firestore'; settings: FirestoreSettings })
  | (DatabaseConnectionBase & { type: 'mysql'; settings: MySqlSettings })
  | (DatabaseConnectionBase & { type: 'postgres'; settings: PostgresSettings });

/**
 * Local RSA identity used to sign and decrypt invites.
 */
export interface InviteIdentity {
  /**
   * PEM-encoded RSA public key.
   */
  publicKeyPem: string;

  /**
   * SHA-256 fingerprint of the public key (hex).
   */
  fingerprint: string;
}

/**
 * A trusted collaborator public key used to verify invite signatures.
 */
export interface TrustedInviteKey {
  /**
   * SHA-256 fingerprint of the SPKI public key (hex).
   */
  id: string;

  /**
   * User-defined label for the key owner.
   */
  label: string;

  /**
   * PEM-encoded RSA public key.
   */
  publicKeyPem: string;

  /**
   * Unix timestamp when the key was added.
   */
  addedAt: number;
}

/**
 * Result of exporting a PEM key to disk via a native save dialog.
 */
export interface PemExportResult {
  /**
   * True when the user canceled the save dialog.
   */
  canceled: boolean;

  /**
   * Absolute path written when not canceled.
   */
  path?: string;
}

/**
 * Menu action identifiers sent from the main process menu.
 */
export type MenuActionId =
  | 'new-request'
  | 'new-collection'
  | 'import'
  | 'save'
  | 'settings'
  | 'certificates'
  | 'about';

/**
 * IPC bridge API exposed to the renderer via contextBridge.
 */
export interface Api {
  /**
   * Lists all collections.
   *
   * @returns All collections from the main process.
   */
  listCollections: () => Promise<Collection[]>;

  /**
   * Creates a new collection.
   *
   * @param name - Display name for the collection.
   * @returns The newly created collection.
   */
  createCollection: (name: string) => Promise<Collection>;

  /**
   * Updates a collection's name, variables, and headers.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @returns The updated collection.
   */
  updateCollection: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string
  ) => Promise<Collection>;

  /**
   * Deletes a collection and all of its saved requests.
   *
   * @param id - Collection ID to delete.
   */
  deleteCollection: (id: number) => Promise<void>;

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
   * Moves a collection and its requests to another database connection.
   *
   * @param id - Global collection ID to move.
   * @param targetConnectionId - Destination connection id.
   * @returns The collection in its new backend with a new global id.
   */
  moveCollection: (id: number, targetConnectionId: string) => Promise<Collection>;

  /**
   * Lists all environments.
   *
   * @returns All environments from the main process.
   */
  listEnvironments: () => Promise<Environment[]>;

  /**
   * Creates a new environment.
   *
   * @param name - Display name for the environment.
   * @returns The newly created environment.
   */
  createEnvironment: (name: string) => Promise<Environment>;

  /**
   * Updates an environment's name and variables.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @returns The updated environment.
   */
  updateEnvironment: (id: number, name: string, variables: Variable[]) => Promise<Environment>;

  /**
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   */
  deleteEnvironment: (id: number) => Promise<void>;

  /**
   * Lists saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests in the collection.
   */
  listRequests: (collectionId: number) => Promise<SavedRequest[]>;

  /**
   * Inserts a new saved request or updates an existing one.
   *
   * @param req - Request fields to persist.
   * @returns The saved request.
   */
  saveRequest: (req: SaveRequestInput) => Promise<SavedRequest>;

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  deleteRequest: (id: number) => Promise<void>;

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

  /**
   * Sends an HTTP request via the main process.
   *
   * @param req - Request configuration to execute.
   * @param requestId - Optional ID used to cancel the in-flight request.
   * @returns Response metadata from the main process.
   */
  sendRequest: (req: SendRequestInput, requestId?: string) => Promise<SendResult>;

  /**
   * Cancels an in-flight HTTP request by ID.
   *
   * @param requestId - ID passed to sendRequest when the request was started.
   */
  cancelRequest: (requestId: string) => Promise<void>;

  /**
   * Returns cookies stored for a hostname.
   *
   * @param domain - Hostname to query.
   */
  getCookies: (domain: string) => Promise<KeyValue[]>;

  /**
   * Persists cookies for a hostname.
   *
   * @param domain - Hostname to update.
   * @param cookies - Cookie rows to store.
   */
  setCookies: (domain: string, cookies: KeyValue[]) => Promise<void>;

  /**
   * Runs a pre/post script in a sandboxed JavaScript context.
   *
   * @param input - Script source, phase, request/response context, and variables.
   * @returns Mutated request, variable sets, tests, and logs from the sandbox.
   */
  runScript: (input: ScriptRunInput) => Promise<ScriptRunResult>;

  /**
   * Subscribes to menu bar action events from the main process.
   *
   * @param callback - Handler invoked with the menu action id.
   * @returns Unsubscribe function.
   */
  onMenuAction: (callback: (action: MenuActionId) => void) => () => void;

  /**
   * Returns the application version from package.json.
   */
  getAppVersion: () => Promise<string>;

  /**
   * Returns the persisted theme preference.
   */
  getTheme: () => Promise<ThemeSource>;

  /**
   * Persists and applies a theme preference.
   *
   * @param theme - Theme source to apply.
   */
  setTheme: (theme: ThemeSource) => Promise<void>;

  /**
   * Returns persisted general request settings.
   */
  getGeneralSettings: () => Promise<GeneralSettings>;

  /**
   * Persists general request settings.
   *
   * @param settings - General configuration to store.
   */
  setGeneralSettings: (settings: GeneralSettings) => Promise<void>;

  /**
   * Lists all configured database connections.
   */
  listDatabaseConnections: () => Promise<DatabaseConnection[]>;

  /**
   * Creates or updates a database connection.
   *
   * @param conn - Connection to persist; empty id inserts a new connection.
   * @returns Updated list of all connections.
   */
  saveDatabaseConnection: (conn: DatabaseConnection) => Promise<DatabaseConnection[]>;

  /**
   * Deletes a database connection by id.
   *
   * @param id - Connection id to remove.
   * @returns Updated list of all connections.
   */
  deleteDatabaseConnection: (id: string) => Promise<DatabaseConnection[]>;

  /**
   * Returns the id of the active database connection.
   */
  getActiveDatabaseId: () => Promise<string>;

  /**
   * Sets the active database connection (applied on restart).
   *
   * @param id - Connection id to activate.
   */
  setActiveDatabaseId: (id: string) => Promise<void>;

  /**
   * Returns the persisted request editor tab for a storage key.
   *
   * @param key - Saved request id or `tab:${tabId}` for unsaved drafts.
   */
  getRequestEditorTab: (key: string) => Promise<EditorTab | null>;

  /**
   * Persists the request editor tab for a storage key.
   *
   * @param key - Saved request id or `tab:${tabId}` for unsaved drafts.
   * @param tab - Editor tab to remember.
   */
  setRequestEditorTab: (key: string, tab: EditorTab) => Promise<void>;

  /**
   * Removes persisted request editor tab state for a storage key.
   *
   * @param key - Saved request id string to clear.
   */
  deleteRequestEditorTab: (key: string) => Promise<void>;

  /**
   * Subscribes to window close and app quit attempts from the main process.
   *
   * @param callback - Handler invoked when the user tries to close or quit.
   * @returns Unsubscribe function.
   */
  onBeforeClose: (callback: () => void) => () => void;

  /**
   * Responds to a close/quit attempt after checking unsaved state or user choice.
   *
   * @param proceed - True to allow close/quit, false to cancel.
   */
  confirmClose: (proceed: boolean) => void;

  /**
   * Opens a native file picker for one or more files.
   *
   * @returns Selected absolute file paths, or an empty array when canceled.
   */
  selectFiles: () => Promise<string[]>;

  /**
   * Creates a signed, encrypted invite for a specific recipient.
   *
   * @param collectionId - Global collection id to share.
   * @param recipientKid - Fingerprint of the recipient's trusted public key.
   */
  createInviteToken: (collectionId: number, recipientKid: string) => Promise<string>;

  /**
   * Decodes an invite JWT and adds the embedded database connection.
   *
   * @param token - JWT string from an invite.
   * @returns Updated list of all connections.
   */
  acceptInvite: (token: string) => Promise<DatabaseConnection[]>;

  /**
   * Returns the local invite identity (public key and fingerprint).
   */
  getInviteIdentity: () => Promise<InviteIdentity>;

  /**
   * Writes the local private key to a file via a native save dialog.
   */
  exportInvitePrivateKey: () => Promise<PemExportResult>;

  /**
   * Writes the local public key to a file via a native save dialog.
   */
  exportInvitePublicKey: () => Promise<PemExportResult>;

  /**
   * Replaces the local invite key pair from a PEM private key file.
   */
  importInviteKeyPair: () => Promise<InviteIdentity>;

  /**
   * Lists trusted collaborator public keys.
   */
  listTrustedKeys: () => Promise<TrustedInviteKey[]>;

  /**
   * Adds or updates a trusted collaborator public key.
   *
   * @param label - Display label for the key owner.
   * @param publicKeyPem - PEM-encoded RSA public key.
   */
  addTrustedKey: (label: string, publicKeyPem: string) => Promise<TrustedInviteKey[]>;

  /**
   * Imports a trusted public key from a PEM file via a native open dialog.
   *
   * @param label - Display label for the key owner.
   */
  importTrustedPublicKey: (label: string) => Promise<TrustedInviteKey[]>;

  /**
   * Removes a trusted public key by fingerprint id.
   *
   * @param id - SHA-256 fingerprint of the key to remove.
   */
  removeTrustedKey: (id: string) => Promise<TrustedInviteKey[]>;
}

declare global {
  /**
   * Extends Window with the preload-exposed API.
   */
  interface Window {
    /**
     * IPC bridge for collections, saved requests, and HTTP execution.
     */
    api: Api;
  }
}
