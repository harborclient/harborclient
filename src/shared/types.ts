import type { AuthConfig } from '#/shared/auth';
import type { ShortcutBinding, ShortcutOverrides } from '#/shared/shortcuts';
import type {
  PluginAssetResult,
  PluginEntryKind,
  PluginFsPickFileOptions,
  PluginFsSaveFileOptions,
  PluginInfo,
  SerializableMenuContribution
} from '#/shared/plugin/types';
import type { PluginCatalog } from '#/shared/plugin/catalog';
import type { CollectionRunnerConfig } from '#/shared/collectionRunner';

export type { AuthConfig, AuthType } from '#/shared/auth';
export type { ShortcutBinding, ShortcutId, ShortcutOverrides } from '#/shared/shortcuts';
export type {
  PluginAssetResult,
  PluginEntryKind,
  PluginFsPickFileOptions,
  PluginFsSaveFileOptions,
  PluginInfo,
  PluginPermission,
  SerializableMenuContribution
} from '#/shared/plugin/types';
export type { PluginCatalog, PluginCatalogEntry } from '#/shared/plugin/catalog';
export type { CollectionRunnerConfig } from '#/shared/collectionRunner';

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
   * Stable portable identifier for export/import deduplication.
   */
  uuid: string;

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
   * Stable portable identifier for export/import deduplication.
   */
  uuid: string;

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
   * Stable portable identifier for export/import deduplication.
   */
  uuid: string;

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
   * Stable portable identifier for export/import deduplication.
   */
  uuid: string;

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
   * Stable portable identifier; omitted in legacy export files.
   */
  uuid?: string;

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

  /**
   * Portable folder identifier; preferred over folder_name when present.
   */
  folder_uuid?: string | null;
}

/**
 * Portable folder shape for collection export/import (no database IDs).
 */
export interface ExportedFolder {
  /**
   * Stable portable identifier; omitted in legacy export files.
   */
  uuid?: string;

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
   * Stable portable identifier; omitted in legacy export files.
   */
  uuid?: string;

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
   * Stable portable identifier; omitted in legacy export files.
   */
  uuid?: string;

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
 * Whether an import created a new document or updated an existing one.
 */
export type ImportAction = 'created' | 'updated';

/**
 * Result of a unified File -> Import action that auto-detects export type.
 */
export type ImportEntityResult =
  | { kind: 'collection'; collection: Collection; action: ImportAction }
  | { kind: 'request'; request: SavedRequest; action: ImportAction }
  | { kind: 'environment'; environment: Environment; action: ImportAction };

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
   * Stable portable identifier; omitted in legacy export files.
   */
  uuid?: string;

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
   * Stable portable identifier; preserved on update, generated on insert when omitted.
   */
  uuid?: string;

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

  /**
   * Saved collection request id when the send originated from a saved request tab.
   */
  sourceRequestId?: number;

  /**
   * Display name from the request tab when {@link sourceRequestId} is set.
   */
  sourceRequestName?: string;
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
export type ThemeSource =
  | 'light'
  | 'dark'
  | 'system'
  | 'high-contrast'
  | `plugin:${string}:${string}`;

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
export type StorageProvider = 'sqlite' | 'firestore' | 'mysql' | 'postgres' | 'git';

/**
 * Kind of collection data provider, including remote team hubs.
 */
export type CollectionProviderKind = StorageProvider | 'team-hub';

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
 * Persisted visibility for the left and AI sidebars.
 */
export interface PanelLayoutState {
  /**
   * Whether the collections sidebar is shown when not hidden by an overlay.
   */
  showSidebar: boolean;

  /**
   * Whether the AI sidebar is shown when not hidden by an overlay.
   */
  showAiSidebar: boolean;
}

/**
 * Persisted AI chat tab session for restoring open tabs on launch.
 */
export interface AiChatSessionState {
  /**
   * Chat ids open in the tab bar, in display order.
   */
  openTabIds: number[];

  /**
   * Currently selected chat tab id, if any.
   */
  activeChatId: number | null;
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
export type SettingsSection =
  | 'general'
  | 'syntax'
  | 'storage'
  | 'shortcuts'
  | 'proxy'
  | 'ai'
  | 'backup-restore'
  | 'plugins'
  | `plugin:${string}:${string}`;

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
 * Role of a message in an LLM completion step (includes tool roles).
 */
export type ChatStepMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Serializable tool call returned from a completion step.
 */
export interface ChatToolCall {
  /**
   * Tool call id from the model.
   */
  id: string;

  /**
   * Tool function name.
   */
  name: string;

  /**
   * JSON-encoded tool arguments.
   */
  arguments: string;
}

/**
 * Serializable message passed to a single LLM completion step.
 */
export interface ChatStepMessage {
  /**
   * OpenAI-compatible message role.
   */
  role: ChatStepMessageRole;

  /**
   * Text content for user, assistant, tool, or system messages.
   */
  content?: string | null;

  /**
   * Tool calls requested by the assistant.
   */
  tool_calls?: ChatToolCall[];

  /**
   * Tool call id this tool message responds to.
   */
  tool_call_id?: string;

  /**
   * Tool name for tool role messages (optional).
   */
  name?: string;
}

/**
 * Input for one stateless LLM completion step.
 */
export interface ChatStepInput {
  /**
   * Provider-specific model id selected in the composer.
   */
  model: string;

  /**
   * Conversation messages excluding the system prompt (injected in main).
   */
  messages: ChatStepMessage[];

  /**
   * Team Hub id when the selected model is hub-proxied.
   */
  hubId?: string;
}

/**
 * One LLM model offered by a Team Hub.
 */
export interface HubLlmModel {
  /**
   * Provider-specific model id.
   */
  id: string;

  /**
   * Human-readable label from the hub.
   */
  label: string;

  /**
   * LLM provider that owns this model.
   */
  provider: LlmProvider;
}

/**
 * Models returned from a single configured Team Hub.
 */
export interface HubLlmModelGroup {
  /**
   * Team Hub identifier from local settings.
   */
  hubId: string;

  /**
   * Display name of the Team Hub.
   */
  hubName: string;

  /**
   * Models the authenticated user may use on this hub.
   */
  models: HubLlmModel[];
}

/**
 * Result of one LLM completion step.
 */
export interface ChatStepResult {
  /**
   * Assistant text when the model finishes without tool calls.
   */
  content: string | null;

  /**
   * Tool calls to execute in the renderer when present.
   */
  toolCalls?: ChatToolCall[];
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
 * How a git-backed connection authenticates for HTTPS fetch/push.
 */
export type GitAuthMethod =
  | {
      /**
       * Personal access token entered by the user.
       */
      kind: 'pat';

      /**
       * Username for Basic Auth (often the account name or `token` on GitHub).
       */
      username: string;
    }
  | {
      /**
       * OAuth token obtained via device flow.
       */
      kind: 'oauth';

      /**
       * OAuth provider that issued the token.
       */
      provider: 'github';
    };

/**
 * Settings for a git-backed collection provider.
 */
export interface GitSettings {
  /**
   * Absolute path to the repository root on disk.
   */
  repoPath: string;

  /**
   * HTTPS clone URL used for fetch and push.
   */
  url: string;

  /**
   * Branch to track (for example `main`).
   */
  branch: string;

  /**
   * Subdirectory within the repo where HarborClient files live.
   */
  subdir: string;

  /**
   * Optional GitHub OAuth App client id; falls back to the built-in app when empty.
   */
  oauthClientId?: string;

  /**
   * Authentication method metadata; secrets are stored separately via secretStorage.
   */
  auth: GitAuthMethod;
}

/**
 * Source-control status for a git-backed provider working tree.
 */
export interface SourceControlStatus {
  /**
   * Count of staged, unstaged, and untracked changes in the working tree.
   */
  changedCount: number;

  /**
   * Current branch name, or null when not on a branch.
   */
  branch: string | null;

  /**
   * Commits ahead of the tracked upstream branch.
   */
  ahead: number;

  /**
   * Commits behind the tracked upstream branch.
   */
  behind: number;

  /**
   * Whether ahead/behind were computed from a cached origin tracking ref.
   * When false, counts are placeholders and the working tree may not be in sync.
   */
  syncKnown: boolean;

  /**
   * Number of files containing unresolved git merge conflict markers.
   */
  conflictCount: number;

  /**
   * Whether the configured HarborClient subdirectory exists on disk.
   */
  harborRootExists: boolean;

  /**
   * Configured HarborClient subdirectory relative to the repository root.
   */
  harborSubdir: string;
}

/**
 * Result of background GitHub OAuth device-flow completion.
 */
export interface GitOAuthFinishedEvent {
  /**
   * Git connection id that finished OAuth.
   */
  connectionId: string;

  /**
   * Whether authorization completed and credentials were validated.
   */
  ok: boolean;

  /**
   * Error message when {@link GitOAuthFinishedEvent.ok} is false.
   */
  error?: string;
}

/**
 * A single entry in the git commit log.
 */
export interface GitLogEntry {
  /**
   * Commit object id (full or abbreviated hash).
   */
  oid: string;

  /**
   * First line of the commit message.
   */
  message: string;

  /**
   * Commit author name.
   */
  author: string;

  /**
   * ISO 8601 commit timestamp.
   */
  timestamp: string;
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
export interface StorageConnectionBase {
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
export type StorageConnection =
  | (StorageConnectionBase & { type: 'sqlite'; settings: SqliteSettings })
  | (StorageConnectionBase & { type: 'firestore'; settings: FirestoreSettings })
  | (StorageConnectionBase & { type: 'mysql'; settings: MySqlSettings })
  | (StorageConnectionBase & { type: 'postgres'; settings: PostgresSettings })
  | (StorageConnectionBase & { type: 'git'; settings: GitSettings });

/**
 * A configured HarborClient Team Hub connection.
 */
export interface TeamHub {
  /**
   * Unique team hub identifier.
   */
  id: string;

  /**
   * User-defined display name.
   */
  name: string;

  /**
   * HarborClient Team Hub base URL (for example `http://127.0.0.1:8788`).
   */
  baseUrl: string;

  /**
   * Bearer token prefixed with `hbk_` for protected routes.
   */
  token: string;
}

/**
 * Result of probing a team hub token via `GET /auth/session`.
 */
export interface TeamHubSessionScanResult {
  /**
   * Team hub connection id that was scanned.
   */
  hubId: string;

  /**
   * When true, the hub token has management API capabilities.
   */
  managementApi: boolean;

  /**
   * Human-readable error when the scan failed; omitted on success.
   */
  error?: string;
}

/**
 * Team Hub user account returned by management routes.
 */
export interface HubUserRecord {
  /**
   * Stable user account identifier.
   */
  id: string;

  /**
   * Unique display name for the account.
   */
  name: string;

  /**
   * Account role determining API capabilities.
   */
  role: 'admin' | 'user';

  /**
   * Collection ids the user may access, or `['*']` for all collections.
   */
  collectionAccess: string[];

  /**
   * Environment ids the user may access, or `['*']` for all environments.
   */
  environmentAccess: string[];

  /**
   * When true, the user may call hub-proxied LLM routes.
   */
  llmAccess: boolean;

  /**
   * LLM model ids the user may use, or `['*']` for all hub-offered models.
   */
  llmModels: string[];

  /**
   * Maximum total tokens per UTC calendar month, or null for unlimited.
   */
  llmMonthlyTokenLimit: number | null;

  /**
   * ISO 8601 timestamp when the account was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the account was last updated.
   */
  updatedAt: string;
}

/**
 * Lightweight id/name record returned by admin list routes for autocomplete.
 */
export interface AdminResourceOption {
  /**
   * Stable resource identifier stored in access lists.
   */
  id: string;

  /**
   * Human-readable label shown in autocomplete suggestions.
   */
  name: string;
}

/**
 * Collection, environment, and LLM model options for admin user management forms.
 */
export interface TeamHubAdminResourceOptions {
  /**
   * All hub collections available when assigning collection access.
   */
  collections: AdminResourceOption[];

  /**
   * All hub environments available when assigning environment access.
   */
  environments: AdminResourceOption[];

  /**
   * All hub-offered LLM models available when assigning model access.
   */
  models: HubLlmModel[];
}

/**
 * Partial fields accepted when updating a Team Hub user via management routes.
 */
export interface UpdateHubUserInput {
  /**
   * New unique display name, when changing the account label.
   */
  name?: string;

  /**
   * New role, when changing account capabilities.
   */
  role?: 'admin' | 'user';

  /**
   * Replacement collection access list.
   */
  collectionAccess?: string[];

  /**
   * Replacement environment access list.
   */
  environmentAccess?: string[];

  /**
   * Whether the user may use hub-proxied LLM routes.
   */
  llmAccess?: boolean;

  /**
   * Replacement LLM model access list.
   */
  llmModels?: string[];

  /**
   * Replacement monthly token limit, or null for unlimited.
   */
  llmMonthlyTokenLimit?: number | null;
}

/**
 * Fields required to create a Team Hub user via management routes.
 */
export interface CreateHubUserInput {
  /**
   * Unique display name for the new account.
   */
  name: string;

  /**
   * Role assigned to the new account.
   */
  role: 'admin' | 'user';

  /**
   * Collection access list; admins store an empty array.
   */
  collectionAccess?: string[];

  /**
   * Environment access list; admins store an empty array.
   */
  environmentAccess?: string[];

  /**
   * Whether the user may use hub-proxied LLM routes.
   */
  llmAccess?: boolean;

  /**
   * Allowed LLM model ids, or `['*']` for all hub-offered models.
   */
  llmModels?: string[];

  /**
   * Monthly token limit, or null for unlimited.
   */
  llmMonthlyTokenLimit?: number | null;
}

/**
 * API token metadata returned by admin token routes.
 */
export interface HubApiTokenRecord {
  /**
   * Stable token record identifier.
   */
  id: string;

  /**
   * Owning user account identifier.
   */
  userId: string;

  /**
   * Human-readable label chosen when the token was created.
   */
  name: string;

  /**
   * Non-secret prefix shown in operator listings.
   */
  tokenPrefix: string;

  /**
   * ISO 8601 timestamp when the token was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the token was last used, if ever.
   */
  lastUsedAt: string | null;

  /**
   * ISO 8601 timestamp when the token was revoked; null when active.
   */
  revokedAt: string | null;
}

/**
 * Response from creating a user account and initial API token.
 */
export interface CreatedHubUser {
  /**
   * Newly created user account.
   */
  user: HubUserRecord;

  /**
   * Metadata for the initial bearer token.
   */
  token: HubApiTokenRecord;

  /**
   * One-time plaintext bearer token secret.
   */
  secret: string;
}

/**
 * Request body for creating an additional API token for a user.
 */
export interface CreateHubTokenInput {
  /**
   * Human-readable label for the new token.
   */
  name: string;
}

/**
 * Response from creating an additional API bearer token.
 */
export interface CreatedHubToken {
  /**
   * Metadata for the newly created bearer token.
   */
  token: HubApiTokenRecord;

  /**
   * One-time plaintext bearer token secret.
   */
  secret: string;
}

/**
 * Local RSA identity used to sign and decrypt share tokens.
 */
export interface SharingIdentity {
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
 * A trusted collaborator public key used to verify share token signatures.
 */
export interface TrustedSharingKey {
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
 * Result of a HarborClient backup export save-dialog action.
 */
export interface BackupExportResult {
  /**
   * True when the user canceled the save dialog.
   */
  canceled: boolean;

  /**
   * Absolute path where the `.hcb` file was written; omitted when canceled.
   */
  path?: string;
}

/**
 * Result of a HarborClient backup restore open-dialog action.
 */
export interface BackupImportResult {
  /**
   * True when the user canceled the open dialog.
   */
  canceled: boolean;

  /**
   * Renderer localStorage entries restored from the backup; omitted when canceled.
   */
  localStorage?: Record<string, string>;
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
  | 'plugins'
  | 'team-hubs'
  | 'sharing-keys'
  | 'join-shared-collection'
  | 'sync'
  | 'toggle-sidebar'
  | 'toggle-ai-sidebar'
  | 'about'
  | 'check-for-updates';

/**
 * Top-level application menu labels shown in the Linux in-app menu bar.
 */
export type RootMenuLabel = 'File' | 'Edit' | 'View' | 'Help';

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
   * Deep-copies an environment into a new record with a fresh uuid.
   *
   * @param id - Environment ID to duplicate.
   * @returns The newly created environment.
   */
  duplicateEnvironment: (id: number) => Promise<Environment>;

  /**
   * Reorders environments in the sidebar.
   *
   * @param orderedEnvironmentIds - Environment ids in desired order.
   */
  reorderEnvironments: (orderedEnvironmentIds: number[]) => Promise<void>;

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
   * Opens a root application submenu at the given window coordinates.
   *
   * @param label - Root menu label to open.
   * @param x - Left edge in window coordinates.
   * @param y - Top edge in window coordinates.
   */
  popupMenuSubmenu: (label: RootMenuLabel, x: number, y: number) => Promise<void>;

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
   * Subscribes to theme preference changes pushed from the main process.
   *
   * @param callback - Called with the new persisted theme preference.
   * @returns Unsubscribe function.
   */
  onThemeChanged: (callback: (theme: ThemeSource) => void) => () => void;

  /**
   * Minimizes the focused application window.
   */
  minimizeWindow: () => Promise<void>;

  /**
   * Toggles maximize on the focused application window.
   */
  toggleMaximizeWindow: () => Promise<void>;

  /**
   * Closes the focused application window, honoring the quit prompt when configured.
   */
  closeWindow: () => Promise<void>;

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
   * Runs one LLM completion step with tool definitions and returns text or tool calls.
   *
   * @param input - Model id and conversation messages for the step.
   */
  completeChatStep: (input: ChatStepInput) => Promise<ChatStepResult>;

  /**
   * Lists LLM models offered by configured Team Hubs for the current user.
   */
  listHubLlmModels: () => Promise<HubLlmModelGroup[]>;

  /**
   * Deletes a chat and its messages.
   *
   * @param id - Chat id to delete.
   */
  deleteChat: (id: number) => Promise<void>;

  /**
   * Lists all configured database connections.
   */
  listStorageConnections: () => Promise<StorageConnection[]>;

  /**
   * Creates or updates a database connection.
   *
   * @param conn - Connection to persist; empty id inserts a new connection.
   * @returns Updated list of all connections.
   */
  saveStorageConnection: (conn: StorageConnection) => Promise<StorageConnection[]>;

  /**
   * Deletes a database connection by id.
   *
   * @param id - Connection id to remove.
   * @returns Updated list of all connections.
   */
  deleteStorageConnection: (id: string) => Promise<StorageConnection[]>;

  /**
   * Lists all configured team hubs.
   */
  listTeamHubs: () => Promise<TeamHub[]>;

  /**
   * Creates or updates a team hub.
   *
   * @param hub - Team hub to persist.
   * @returns Updated list of all team hubs.
   */
  saveTeamHub: (hub: TeamHub) => Promise<TeamHub[]>;

  /**
   * Deletes a team hub by id.
   *
   * @param id - Team hub id to remove.
   * @returns Updated list of all team hubs.
   */
  deleteTeamHub: (id: string) => Promise<TeamHub[]>;

  /**
   * Probes each configured team hub for session capabilities via `GET /auth/session`.
   */
  scanTeamHubSessions: () => Promise<TeamHubSessionScanResult[]>;

  /**
   * Lists Team Hub user accounts using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubUsers: (hubId: string) => Promise<HubUserRecord[]>;

  /**
   * Updates a Team Hub user account using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param userId - User account identifier to update.
   * @param input - Partial user fields to apply.
   */
  updateTeamHubUser: (
    hubId: string,
    userId: string,
    input: UpdateHubUserInput
  ) => Promise<HubUserRecord>;

  /**
   * Deletes a Team Hub user account using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param userId - User account identifier to delete.
   */
  deleteTeamHubUser: (hubId: string, userId: string) => Promise<void>;

  /**
   * Creates a Team Hub user account and initial token using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param input - User fields for the new account.
   */
  createTeamHubUser: (hubId: string, input: CreateHubUserInput) => Promise<CreatedHubUser>;

  /**
   * Lists Team Hub API tokens using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubTokens: (hubId: string) => Promise<HubApiTokenRecord[]>;

  /**
   * Creates a Team Hub API token for a user using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param userId - Owning user account identifier.
   * @param input - Human-readable label for the new token.
   */
  createTeamHubUserToken: (
    hubId: string,
    userId: string,
    input: CreateHubTokenInput
  ) => Promise<CreatedHubToken>;

  /**
   * Deletes a Team Hub API token using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param tokenId - Token record identifier to delete.
   */
  deleteTeamHubToken: (hubId: string, tokenId: string) => Promise<void>;

  /**
   * Loads collection, environment, and LLM model options for admin user management.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubAdminResourceOptions: (hubId: string) => Promise<TeamHubAdminResourceOptions>;

  /**
   * Re-reads collection data from a single provider (database or team hub).
   *
   * @param connectionId - Provider connection id to sync.
   */
  syncProvider: (connectionId: string) => Promise<void>;

  /**
   * Returns source-control status for each mounted git-backed connection.
   */
  listGitStatuses: () => Promise<Record<string, SourceControlStatus>>;

  /**
   * Subscribes to working-tree changes for git-backed connections (pull, external edits).
   *
   * @param callback - Handler invoked with the connection id whose tree changed.
   * @returns Unsubscribe function.
   */
  onGitWorkingTreeChanged: (callback: (connectionId: string) => void) => () => void;

  /**
   * Subscribes to background GitHub OAuth completion for a git-backed connection.
   *
   * @param callback - Handler invoked when OAuth polling finishes or fails.
   * @returns Unsubscribe function.
   */
  onGitOAuthFinished: (callback: (event: GitOAuthFinishedEvent) => void) => () => void;

  /**
   * Stages all changes and commits in a git-backed connection working tree.
   *
   * @param connectionId - Git connection id.
   * @param message - Commit message.
   * @param createHarborRoot - When true, creates the HarborClient subdirectory layout if missing.
   */
  gitCommit: (connectionId: string, message: string, createHarborRoot?: boolean) => Promise<void>;

  /**
   * Pulls (fetch + merge) for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   */
  gitPull: (connectionId: string) => Promise<void>;

  /**
   * Pushes commits to the remote for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   */
  gitPush: (connectionId: string) => Promise<void>;

  /**
   * Returns recent commits for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   * @param depth - Maximum number of commits to return.
   */
  gitLog: (connectionId: string, depth?: number) => Promise<GitLogEntry[]>;

  /**
   * Stores a PAT for a git-backed connection and validates credentials via fetch.
   *
   * @param connectionId - Git connection id.
   * @param username - Basic Auth username.
   * @param token - Personal access token.
   */
  gitSetPat: (connectionId: string, username: string, token: string) => Promise<void>;

  /**
   * Starts GitHub OAuth device flow for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   * @returns Device flow code and verification URL for the user to approve in a browser.
   */
  gitStartOAuth: (connectionId: string) => Promise<{ userCode: string; verificationUri: string }>;

  /**
   * Completes GitHub OAuth device flow after the user approves in a browser.
   *
   * Ensures background polling is running when a pending device flow exists.
   * Resolves immediately without waiting for GitHub approval.
   *
   * @param connectionId - Git connection id.
   */
  gitCompleteOAuth: (connectionId: string) => Promise<void>;

  /**
   * Removes stored GitHub OAuth tokens and resets auth metadata for a git connection.
   *
   * @param connectionId - Git connection id.
   */
  gitRevokeOAuth: (connectionId: string) => Promise<void>;

  /**
   * Returns the id of the active database connection.
   */
  getActiveStorageId: () => Promise<string>;

  /**
   * Sets the active database connection (applied on restart).
   *
   * @param id - Connection id to activate.
   */
  setActiveStorageId: (id: string) => Promise<void>;

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
   * Returns persisted sidebar and AI sidebar visibility preferences.
   */
  getPanelLayout: () => Promise<PanelLayoutState>;

  /**
   * Persists sidebar and AI sidebar visibility preferences.
   *
   * @param state - Panel layout snapshot to store.
   */
  setPanelLayout: (state: PanelLayoutState) => Promise<void>;

  /**
   * Returns persisted AI chat open tabs and active tab.
   */
  getAiChatSession: () => Promise<AiChatSessionState>;

  /**
   * Persists AI chat open tabs and active tab.
   *
   * @param state - Chat session snapshot to store.
   */
  setAiChatSession: (state: AiChatSessionState) => Promise<void>;

  /**
   * Returns persisted collection runner configuration.
   */
  getCollectionRunnerConfig: () => Promise<CollectionRunnerConfig>;

  /**
   * Persists collection runner configuration.
   *
   * @param config - Runner settings snapshot to store.
   */
  setCollectionRunnerConfig: (config: CollectionRunnerConfig) => Promise<void>;

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
   * Opens a native directory picker.
   *
   * @param defaultPath - Initial directory shown in the dialog, if any.
   * @returns Selected absolute directory path, or null when canceled.
   */
  selectDirectory: (defaultPath: string) => Promise<string | null>;

  /**
   * Creates a signed, encrypted share token for a specific recipient.
   *
   * @param collectionId - Global collection id to share.
   * @param recipientKid - Fingerprint of the recipient's trusted public key.
   */
  createShareToken: (collectionId: number, recipientKid: string) => Promise<string>;

  /**
   * Decodes a share JWT and adds the embedded database connection.
   *
   * @param token - JWT string from a share token.
   * @returns Updated list of all connections.
   */
  joinSharedCollection: (token: string) => Promise<StorageConnection[]>;

  /**
   * Returns the local sharing identity (public key and fingerprint).
   */
  getSharingIdentity: () => Promise<SharingIdentity>;

  /**
   * Writes the local private key to a file via a native save dialog.
   */
  exportSharingPrivateKey: () => Promise<PemExportResult>;

  /**
   * Writes the local public key to a file via a native save dialog.
   */
  exportSharingPublicKey: () => Promise<PemExportResult>;

  /**
   * Replaces the local sharing key pair from a PEM private key file.
   */
  importSharingKeyPair: () => Promise<SharingIdentity>;

  /**
   * Lists trusted collaborator public keys.
   */
  listTrustedKeys: () => Promise<TrustedSharingKey[]>;

  /**
   * Adds or updates a trusted collaborator public key.
   *
   * @param label - Display label for the key owner.
   * @param publicKeyPem - PEM-encoded RSA public key.
   */
  addTrustedKey: (label: string, publicKeyPem: string) => Promise<TrustedSharingKey[]>;

  /**
   * Imports a trusted public key from a PEM file via a native open dialog.
   *
   * @param label - Display label for the key owner.
   */
  importTrustedPublicKey: (label: string) => Promise<TrustedSharingKey[]>;

  /**
   * Removes a trusted public key by fingerprint id.
   *
   * @param id - SHA-256 fingerprint of the key to remove.
   */
  removeTrustedKey: (id: string) => Promise<TrustedSharingKey[]>;

  /**
   * Writes text to a file chosen via a native save dialog.
   *
   * @param content - UTF-8 text to write.
   * @param defaultPath - Suggested filename for the save dialog.
   */
  saveTextFile: (content: string, defaultPath: string) => Promise<SaveTextFileResult>;

  /**
   * Exports all local HarborClient data to a `.hcb` backup file via a native save dialog.
   *
   * @param localStorage - Renderer localStorage snapshot to embed in the archive.
   */
  exportBackup: (localStorage: Record<string, string>) => Promise<BackupExportResult>;

  /**
   * Restores local HarborClient data from a `.hcb` backup file via a native open dialog.
   *
   * @returns Restored renderer localStorage when written; the app should restart afterward.
   */
  importBackup: () => Promise<BackupImportResult>;

  /**
   * Relaunches HarborClient so restored on-disk state is loaded cleanly.
   */
  restartApp: () => Promise<void>;

  /**
   * Lists installed and unpacked plugins.
   */
  listPlugins: () => Promise<PluginInfo[]>;

  /**
   * Fetches the curated plugin marketplace catalog from harborclient.com.
   */
  getPluginCatalog: () => Promise<PluginCatalog>;

  /**
   * Installs a plugin from a native file picker (.hcp / .zip).
   */
  installPlugin: () => Promise<PluginInfo | null>;

  /**
   * Installs a plugin from an absolute archive path.
   *
   * @param path - Absolute path to a `.hcp` or `.zip` plugin package.
   */
  installPluginFromPath: (path: string) => Promise<PluginInfo>;

  /**
   * Installs a plugin by cloning a public git repository.
   *
   * @param url - Public https (or http) repository URL.
   * @param ref - Optional branch or tag to clone.
   */
  installPluginFromGit: (url: string, ref?: string) => Promise<PluginInfo>;

  /**
   * Re-clones a git-installed plugin from its stored origin.
   *
   * @param pluginId - Plugin manifest id.
   */
  updatePluginFromGit: (pluginId: string) => Promise<PluginInfo>;

  /**
   * Uninstalls an installed plugin by id.
   *
   * @param pluginId - Plugin manifest id.
   */
  uninstallPlugin: (pluginId: string) => Promise<void>;

  /**
   * Enables or disables a plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @param enabled - Whether the plugin should activate.
   */
  setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<PluginInfo>;

  /**
   * Loads an unpacked plugin from a native directory picker.
   */
  loadUnpackedPlugin: () => Promise<PluginInfo | null>;

  /**
   * Loads an unpacked plugin from an absolute directory path.
   *
   * @param path - Absolute path to the plugin project folder.
   */
  loadUnpackedPluginFromPath: (path: string) => Promise<PluginInfo>;

  /**
   * Reloads one plugin from disk.
   *
   * @param pluginId - Plugin manifest id.
   */
  reloadPlugin: (pluginId: string) => Promise<PluginInfo>;

  /**
   * Removes an unpacked dev plugin registration.
   *
   * @param pluginId - Plugin manifest id.
   */
  removeUnpackedPlugin: (pluginId: string) => Promise<void>;

  /**
   * Reads a plugin entry bundle as UTF-8 source text.
   *
   * @param pluginId - Plugin manifest id.
   * @param kind - Renderer or main entry.
   */
  readPluginEntry: (pluginId: string, kind: PluginEntryKind) => Promise<string>;

  /**
   * Reads a plugin asset relative to the plugin root.
   *
   * @param pluginId - Plugin manifest id.
   * @param assetPath - Plugin-relative asset path.
   */
  readPluginAsset: (pluginId: string, assetPath: string) => Promise<PluginAssetResult>;

  /**
   * Returns a plugin-scoped persisted value.
   *
   * @param pluginId - Plugin manifest id.
   * @param key - Storage key within the plugin namespace.
   */
  getPluginStorage: (pluginId: string, key: string) => Promise<unknown>;

  /**
   * Persists a plugin-scoped JSON-serializable value.
   *
   * @param pluginId - Plugin manifest id.
   * @param key - Storage key within the plugin namespace.
   * @param value - Value to store.
   */
  setPluginStorage: (pluginId: string, key: string, value: unknown) => Promise<void>;

  /**
   * Activates a plugin main entry in the SES utilityProcess runner.
   *
   * Main entry source and permissions are resolved in the main process from disk.
   *
   * @param pluginId - Plugin manifest id.
   */
  activatePluginMain: (pluginId: string) => Promise<void>;

  /**
   * Deactivates a plugin main entry in the SES utilityProcess runner.
   *
   * @param pluginId - Plugin manifest id.
   */
  deactivatePluginMain: (pluginId: string) => Promise<void>;

  /**
   * Records or clears a plugin activation/runtime error shown in Settings.
   *
   * @param pluginId - Plugin manifest id.
   * @param message - Error message, or null to clear.
   */
  reportPluginRuntimeError: (pluginId: string, message: string | null) => Promise<PluginInfo>;

  /**
   * Invokes a plugin IPC handler registered in the main runtime.
   *
   * @param pluginId - Plugin manifest id.
   * @param channel - Registered channel name.
   * @param args - Arguments from the renderer half.
   */
  invokePluginMain: (pluginId: string, channel: string, args: unknown[]) => Promise<unknown>;

  /**
   * Subscribes to plugin change notifications from the main process.
   *
   * @param callback - Called with the changed plugin id.
   */
  onPluginsChanged: (callback: (pluginId: string) => void) => () => void;

  /**
   * Pushes plugin menu contributions to the main process for menu merge.
   */
  setPluginMenuContributions: (contributions: SerializableMenuContribution[]) => Promise<void>;

  /**
   * Subscribes to plugin menu command clicks from the application menu.
   */
  onPluginMenuCommand: (
    callback: (payload: { pluginId: string; command: string }) => void
  ) => () => void;

  /**
   * Opens a native file picker for a plugin with filesystem:pick permission.
   */
  pluginFsPickFile: (pluginId: string, options?: PluginFsPickFileOptions) => Promise<string[]>;

  /**
   * Opens a native directory picker for a plugin with filesystem:pick permission.
   */
  pluginFsPickDirectory: (pluginId: string, defaultPath?: string) => Promise<string | null>;

  /**
   * Saves text to a user-selected path for a plugin with filesystem:pick permission.
   */
  pluginFsSaveFile: (
    pluginId: string,
    content: string,
    options?: PluginFsSaveFileOptions
  ) => Promise<string | null>;

  /**
   * Reads a UTF-8 file from an allowlisted path for a plugin.
   */
  pluginFsReadFile: (pluginId: string, path: string) => Promise<string>;

  /**
   * Writes a UTF-8 file to an allowlisted path for a plugin.
   */
  pluginFsWriteFile: (pluginId: string, path: string, content: string) => Promise<void>;

  /**
   * Watches an allowlisted file for changes and invokes the callback when it changes.
   */
  pluginFsWatchFile: (pluginId: string, path: string, callback: () => void) => () => void;
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
