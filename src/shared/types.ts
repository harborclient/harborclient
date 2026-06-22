import type { AuthConfig } from '#/shared/auth';
import type { ShortcutBinding, ShortcutOverrides } from '#/shared/shortcuts';

export type { AuthConfig, AuthType } from '#/shared/auth';
export type { ShortcutBinding, ShortcutId, ShortcutOverrides } from '#/shared/shortcuts';

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
   * Default Authorization settings inherited by requests unless overridden.
   */
  auth: AuthConfig;

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
 * Result of listing collections, including user-facing warnings when a backend
 * could not be read.
 */
export interface ListCollectionsResult {
  /**
   * Collections from the registry, with data hydrated from available backends.
   */
  collections: Collection[];

  /**
   * Warnings when one or more database connections were unavailable or failed
   * to respond; the list may be incomplete.
   */
  warnings: string[];
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
   * Authorization settings; none inherits collection auth at send time.
   */
  auth: AuthConfig;

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
   * Authorization settings; none inherits collection auth at send time.
   */
  auth?: AuthConfig;

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
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a collection export.
   */
  harborclientExport: 'collection';

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
   * Default Authorization settings inherited by requests unless overridden.
   */
  auth?: AuthConfig;

  /**
   * JavaScript run before every request in this collection.
   */
  pre_request_script: string;

  /**
   * JavaScript run after every request in this collection.
   */
  post_request_script: string;

  /**
   * Folders for organizing requests within the collection.
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
 * Portable environment export file format.
 */
export interface EnvironmentExport {
  /**
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as an environment export.
   */
  harborclientExport: 'environment';

  /**
   * Display name for the environment.
   */
  name: string;

  /**
   * Environment-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];
}

/**
 * Result of a unified File -> Import action that auto-detects export type.
 */
export type ImportEntityResult =
  | { kind: 'collection'; collection: Collection }
  | { kind: 'request'; request: SavedRequest }
  | { kind: 'environment'; environment: Environment };

/**
 * Portable single-request export file format.
 */
export interface RequestExport {
  /**
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a request export.
   */
  harborclientExport: 'request';

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
   * Authorization settings; none inherits collection auth at send time.
   */
  auth?: AuthConfig;

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
   * Authorization settings; none inherits collection auth at send time.
   */
  auth: AuthConfig;

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
 * Collection context passed into a pre/post script sandbox.
 */
export interface ScriptCollectionContext {
  /**
   * Collection database id, or null when the request has no collection.
   */
  id: number | null;
  /**
   * Display name of the collection, or empty when none is associated.
   */
  name: string;
  /**
   * Raw collection headers (unsubstituted {{var}} values).
   */
  headers: KeyValue[];
}

/**
 * Environment context passed into a pre/post script sandbox.
 */
export interface ScriptEnvironmentContext {
  /**
   * Active environment display name, or empty when none is active.
   */
  name: string;
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
  /**
   * Active collection metadata and headers when the request belongs to a collection.
   */
  collection?: ScriptCollectionContext;
  /**
   * Active environment metadata when an environment is selected.
   */
  environment?: ScriptEnvironmentContext;
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
  /**
   * Values set via hc.collection.variables.set; persisted to the collection after send.
   */
  collectionVariableSets: Record<string, string>;
  /**
   * Collection headers after hc.collection.headers mutations; persisted after send.
   */
  collectionHeaders: KeyValue[];
  /**
   * Values set via hc.environment.variables.set; persisted to the active environment after send.
   */
  environmentVariableSets: Record<string, string>;
  tests: ScriptTestResult[];
  logs: string[];
  error?: string;
}

/**
 * Theme preference for light, dark, system, or high-contrast appearance.
 */
export type ThemeSource = 'light' | 'dark' | 'system' | 'high-contrast';

/**
 * Named CodeMirror syntax themes available in settings.
 */
export type CodeEditorTheme =
  | 'default'
  | 'dracula'
  | 'githubLight'
  | 'githubDark'
  | 'monokai'
  | 'nord'
  | 'solarizedLight'
  | 'tokyoNight';

/**
 * CodeMirror basicSetup options for editable editor instances.
 */
export interface CodeEditorSetup {
  /**
   * When true, shows line numbers in the gutter.
   */
  lineNumbers: boolean;

  /**
   * When true, shows the code-folding gutter.
   */
  foldGutter: boolean;

  /**
   * When true, highlights the line containing the cursor.
   */
  highlightActiveLine: boolean;

  /**
   * When true, highlights the active line number in the gutter.
   */
  highlightActiveLineGutter: boolean;
}

/**
 * Active database backend for collections and requests.
 */
export type DatabaseProvider = 'sqlite' | 'firestore' | 'mysql' | 'postgres';

/**
 * Kind of collection data provider, including remote service hubs.
 */
export type CollectionProviderKind = DatabaseProvider | 'service-hub';

/**
 * Request editor tab identifiers.
 */
export type EditorTab =
  | 'params'
  | 'headers'
  | 'auth'
  | 'cookies'
  | 'body'
  | 'pre'
  | 'post'
  | 'comment';

/**
 * Persisted sidebar expansion state for sections, collections, and folders.
 */
export interface SidebarExpansionState {
  /**
   * Expanded/collapsed state for top-level sidebar sections.
   */
  sections: {
    /**
     * Whether the Collections section body is visible.
     */
    collections: boolean;

    /**
     * Whether the Environments section body is visible.
     */
    environments: boolean;
  };

  /**
   * Collection ids whose request trees are expanded in the sidebar.
   */
  collectionIds: number[];

  /**
   * Folder ids whose request lists are expanded in the sidebar.
   */
  folderIds: number[];
}

/**
 * Proxy protocol used to connect to the proxy server.
 */
export type ProxyProtocol = 'http' | 'https';

/**
 * Global HTTP proxy configuration applied to every outbound request.
 */
export interface ProxySettings {
  /**
   * When true, outbound requests are routed through the configured proxy.
   */
  enabled: boolean;

  /**
   * Protocol used to connect to the proxy server.
   */
  protocol: ProxyProtocol;

  /**
   * Proxy server hostname or IP address.
   */
  host: string;

  /**
   * Proxy server port.
   */
  port: number;

  /**
   * When true, HTTP Basic authentication credentials are sent to the proxy.
   */
  authEnabled: boolean;

  /**
   * Username for proxy HTTP Basic authentication.
   */
  username: string;

  /**
   * Password for proxy HTTP Basic authentication.
   */
  password: string;
}

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

  /**
   * CodeMirror syntax theme applied to all editor instances.
   */
  codeEditorTheme: CodeEditorTheme;

  /**
   * CodeMirror basicSetup options for editable editor instances.
   */
  codeEditorSetup: CodeEditorSetup;

  /**
   * Global HTTP proxy applied to every outbound request.
   */
  proxy: ProxySettings;
}

/**
 * Settings sidebar section identifiers.
 */
export type SettingsSection = 'general' | 'syntax' | 'databases' | 'shortcuts' | 'proxy' | 'ai';

/**
 * AI provider API keys stored locally for future assistant features.
 */
export interface AiSettings {
  /**
   * OpenAI API key.
   */
  openaiApiKey: string;

  /**
   * Anthropic Claude API key.
   */
  claudeApiKey: string;

  /**
   * Google Gemini API key.
   */
  geminiApiKey: string;
}

/**
 * Supported LLM providers for the OpenAI SDK compatibility layer.
 */
export type LlmProvider = 'openai' | 'claude' | 'gemini';

/**
 * Role of a message in an AI chat thread.
 */
export type ChatRole = 'user' | 'assistant';

/**
 * A single message in an AI chat thread.
 */
export interface ChatMessage {
  /**
   * Database row id.
   */
  id: number;

  /**
   * Parent chat id.
   */
  chatId: number;

  /**
   * Whether the message is from the user or the assistant.
   */
  role: ChatRole;

  /**
   * Message body text.
   */
  content: string;

  /**
   * Model id used when the message was sent, if any.
   */
  model?: string;

  /**
   * ISO timestamp when the message was created.
   */
  created_at: string;
}

/**
 * Summary row for a chat in history lists.
 */
export interface ChatSummary {
  /**
   * Database row id.
   */
  id: number;

  /**
   * Display title for the chat tab and history list.
   */
  title: string;

  /**
   * Last selected model id for this chat, if any.
   */
  model?: string;

  /**
   * ISO timestamp when the chat was last updated.
   */
  updated_at: string;
}

/**
 * Full chat record including ordered messages.
 */
export interface Chat extends ChatSummary {
  /**
   * ISO timestamp when the chat was created.
   */
  created_at: string;

  /**
   * Messages in chronological order.
   */
  messages: ChatMessage[];
}

/**
 * Input for creating a new chat.
 */
export interface CreateChatInput {
  /**
   * Optional initial title; defaults to "New Chat".
   */
  title?: string;

  /**
   * Optional initial model id.
   */
  model?: string;
}

/**
 * Input for appending a message to a chat.
 */
export interface AddChatMessageInput {
  /**
   * Parent chat id.
   */
  chatId: number;

  /**
   * Message author role.
   */
  role: ChatRole;

  /**
   * Message body text.
   */
  content: string;

  /**
   * Model id used for this message, if any.
   */
  model?: string;
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
 * A configured HarborClient Server service hub connection.
 */
export interface ServiceHub {
  /**
   * Unique service hub identifier.
   */
  id: string;

  /**
   * User-defined display name.
   */
  name: string;

  /**
   * HarborClient Server base URL (for example `http://127.0.0.1:8788`).
   */
  baseUrl: string;

  /**
   * Bearer token prefixed with `hbk_` for protected routes.
   */
  token: string;
}

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
 * Result of saving arbitrary text to disk via a native save dialog.
 */
export interface SaveTextFileResult {
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
  | 'service-hubs'
  | 'certificates'
  | 'accept-invite'
  | 'sync'
  | 'toggle-sidebar'
  | 'toggle-ai-sidebar'
  | 'about'
  | 'check-for-updates';

/**
 * Result of comparing the running app version against the latest GitHub release.
 */
export interface UpdateCheckResult {
  /**
   * Semver of the currently running application.
   */
  currentVersion: string;
  /**
   * Semver of the latest published release on GitHub.
   */
  latestVersion: string;
  /**
   * True when the latest release is newer than the running version.
   */
  updateAvailable: boolean;
  /**
   * URL where the user can download releases.
   */
  releaseUrl: string;
}

/**
 * IPC bridge API exposed to the renderer via contextBridge.
 */
export interface Api {
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
    auth: AuthConfig
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
   * @returns The imported entity, or null when the dialog was canceled.
   */
  importEntity: (activeCollectionId: number | null) => Promise<ImportEntityResult | null>;

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
   * Syncs sidebar visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the sidebar is currently visible in the renderer.
   */
  setMenuSidebarVisible: (visible: boolean) => Promise<void>;

  /**
   * Syncs AI sidebar visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the AI sidebar is currently visible in the renderer.
   */
  setMenuAiSidebarVisible: (visible: boolean) => Promise<void>;

  /**
   * Returns the application version from package.json.
   */
  getAppVersion: () => Promise<string>;

  /**
   * Fetches the latest GitHub release and compares it to the running version.
   */
  checkForUpdates: () => Promise<UpdateCheckResult>;

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
   * Returns persisted AI provider API keys.
   */
  getAiSettings: () => Promise<AiSettings>;

  /**
   * Persists AI provider API keys.
   *
   * @param settings - AI configuration to store.
   */
  setAiSettings: (settings: AiSettings) => Promise<void>;

  /**
   * Lists all AI chats ordered by most recently updated.
   */
  listChats: () => Promise<ChatSummary[]>;

  /**
   * Creates a new AI chat thread.
   *
   * @param input - Optional title and model for the new chat.
   */
  createChat: (input: CreateChatInput) => Promise<Chat>;

  /**
   * Loads a chat and its messages by id.
   *
   * @param id - Chat id to load.
   */
  getChat: (id: number) => Promise<Chat | null>;

  /**
   * Appends a message to a chat thread.
   *
   * @param input - Chat id, role, content, and optional model.
   */
  addChatMessage: (input: AddChatMessageInput) => Promise<ChatMessage>;

  /**
   * Deletes a chat and its messages.
   *
   * @param id - Chat id to delete.
   */
  deleteChat: (id: number) => Promise<void>;

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
   * Lists all configured service hubs.
   */
  listServiceHubs: () => Promise<ServiceHub[]>;

  /**
   * Creates or updates a service hub.
   *
   * @param hub - Service hub to persist.
   * @returns Updated list of all service hubs.
   */
  saveServiceHub: (hub: ServiceHub) => Promise<ServiceHub[]>;

  /**
   * Deletes a service hub by id.
   *
   * @param id - Service hub id to remove.
   * @returns Updated list of all service hubs.
   */
  deleteServiceHub: (id: string) => Promise<ServiceHub[]>;

  /**
   * Re-reads collection data from a single provider (database or service hub).
   *
   * @param connectionId - Provider connection id to sync.
   */
  syncProvider: (connectionId: string) => Promise<void>;

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
   * Returns persisted sidebar expansion for sections, collections, and folders.
   */
  getSidebarExpansion: () => Promise<SidebarExpansionState>;

  /**
   * Persists sidebar expansion for sections, collections, and folders.
   *
   * @param state - Expansion snapshot to store.
   */
  setSidebarExpansion: (state: SidebarExpansionState) => Promise<void>;

  /**
   * Returns resolved keyboard shortcut bindings with user overrides applied.
   */
  getShortcuts: () => Promise<ShortcutBinding[]>;

  /**
   * Persists keyboard shortcut overrides and rebuilds the application menu.
   *
   * @param overrides - Shortcut overrides keyed by shortcut id.
   */
  setShortcuts: (overrides: ShortcutOverrides) => Promise<ShortcutBinding[]>;

  /**
   * Clears keyboard shortcut overrides and restores default bindings.
   */
  resetShortcuts: () => Promise<ShortcutBinding[]>;

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

  /**
   * Writes text to a file chosen via a native save dialog.
   *
   * @param content - UTF-8 text to write.
   * @param defaultPath - Suggested filename for the save dialog.
   */
  saveTextFile: (content: string, defaultPath: string) => Promise<SaveTextFileResult>;
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
