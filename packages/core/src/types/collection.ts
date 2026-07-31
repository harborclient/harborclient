import type { AuthConfig } from '../auth';
import type { RunResultsExport } from '../collectionRunner';
import type { CustomTheme } from './customTheme';
import type { Environment } from './environment';
import type { SavedRequest } from './request';
import type { Snippet } from './snippet';
import type { Website } from './website';
import type { Workspace } from './workspace';
import type { ScriptRef } from './script';
import type { BodyType, HttpMethod, KeyValue, Variable } from './common';

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
   * User-Agent override for requests in this collection; empty inherits the global default.
   */
  userAgent: string;

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
   * Ordered collection pre-request scripts; canonical source when non-empty.
   */
  pre_request_scripts: ScriptRef[];

  /**
   * Ordered collection post-request scripts; canonical source when non-empty.
   */
  post_request_scripts: ScriptRef[];

  /**
   * ISO 8601 timestamp when the collection was created.
   */
  created_at: string;

  /**
   * When true on a team hub collection, non-admin users cannot delete it on the server.
   */
  deletion_locked?: boolean;

  /**
   * Id of the database connection that stores this collection.
   */
  connectionId?: string;

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;

  /**
   * When true, the collection is hidden from the Collections tree and listed
   * in the Archive sidebar section instead. Stored in the local registry.
   */
  archived?: boolean;

  /**
   * Remote URL this collection was imported from, when present.
   * Stored in the local registry and used by the sidebar Refresh action.
   */
  sourceUrl?: string | null;
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
 * A folder for organizing requests within a collection (supports nested subfolders).
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
   * Parent folder ID within the same collection, or null for a collection-root folder.
   */
  parent_folder_id: number | null;

  /**
   * Stable portable identifier for export/import deduplication.
   */
  uuid: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Position among sibling folders that share the same parent for sidebar ordering.
   */
  sort_order: number;

  /**
   * Folder-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];

  /**
   * Headers sent with every request in this folder.
   */
  headers: KeyValue[];

  /**
   * User-Agent override for requests in this folder; empty inherits collection then global.
   */
  userAgent: string;

  /**
   * Default Authorization settings inherited by requests unless overridden.
   */
  auth: AuthConfig;

  /**
   * JavaScript run before every request in this folder (before request-level pre script).
   */
  pre_request_script: string;

  /**
   * JavaScript run after every request in this folder (after request-level post script).
   */
  post_request_script: string;

  /**
   * Ordered folder pre-request scripts; canonical source when non-empty.
   */
  pre_request_scripts: ScriptRef[];

  /**
   * Ordered folder post-request scripts; canonical source when non-empty.
   */
  post_request_scripts: ScriptRef[];

  /**
   * ISO 8601 timestamp when the folder was created.
   */
  created_at: string;

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
}

/**
 * A markdown document attached to a collection or folder (for example README.md).
 */
export interface CollectionDocument {
  /**
   * Unique database ID.
   */
  id: number;

  /**
   * ID of the collection this document belongs to.
   */
  collection_id: number;

  /**
   * Stable portable identifier for export/import deduplication.
   */
  uuid: string;

  /**
   * ID of the folder containing this document; null for collection root.
   */
  folder_id: number | null;

  /**
   * Display file name shown in the sidebar (for example README.md).
   */
  name: string;

  /**
   * Markdown body content.
   */
  content: string;

  /**
   * Position among sibling documents for sidebar ordering.
   */
  sort_order: number;

  /**
   * ISO 8601 timestamp when the document was created.
   */
  created_at: string;

  /**
   * ISO 8601 timestamp when the document was last updated.
   */
  updated_at: string;

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
}

/**
 * Input for creating or updating a collection document.
 */
export interface SaveDocumentInput {
  /**
   * Existing document id when updating; omitted on create.
   */
  id?: number;

  /**
   * ID of the collection this document belongs to.
   */
  collection_id: number;

  /**
   * Stable portable identifier; generated when omitted on create.
   */
  uuid?: string;

  /**
   * ID of the folder containing this document; null for collection root.
   */
  folder_id?: number | null;

  /**
   * Display file name (for example README.md).
   */
  name: string;

  /**
   * Markdown body content.
   */
  content?: string;

  /**
   * Position among sibling documents for sidebar ordering.
   */
  sort_order?: number;

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
}

/**
 * Portable document shape for collection export/import (no database IDs).
 */
export interface ExportedDocument {
  /**
   * Stable portable identifier; omitted in legacy export files.
   */
  uuid?: string;

  /**
   * Display file name (for example README.md).
   */
  name: string;

  /**
   * Markdown body content.
   */
  content: string;

  /**
   * Position among sibling documents for sidebar ordering.
   */
  sort_order: number;

  /**
   * Name of the folder containing this document; null or omitted for collection root.
   */
  folder_name?: string | null;

  /**
   * Portable folder identifier; preferred over folder_name when present.
   */
  folder_uuid?: string | null;

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
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
   * User-Agent override for this request; empty inherits. Omitted in legacy exports.
   */
  userAgent?: string;

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
   * Verbatim Raw body override; null when the structured editor is authoritative.
   * Omitted in legacy export files.
   */
  body_raw?: string | null;

  /**
   * When true, the Raw body drawer is open in the request editor.
   * Omitted in legacy export files.
   */
  body_raw_open?: boolean;

  /**
   * JavaScript run before the request is sent.
   */
  pre_request_script: string;

  /**
   * JavaScript run after the response is received.
   */
  post_request_script: string;

  /**
   * Ordered pre-request scripts when exported from a newer HarborClient build.
   */
  pre_request_scripts?: ScriptRef[];

  /**
   * Ordered post-request scripts when exported from a newer HarborClient build.
   */
  post_request_scripts?: ScriptRef[];

  /**
   * Free-form notes for this request.
   */
  comment: string;

  /**
   * Comma-separated labels for organizing and searching requests.
   */
  tags: string;

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

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
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
   * Portable uuid of the parent folder, or null/omitted for a collection-root folder.
   */
  parent_folder_uuid?: string | null;

  /**
   * Position among sibling folders that share the same parent for sidebar ordering.
   */
  sort_order: number;

  /**
   * Folder-scoped variables for {{key}} substitution in requests.
   */
  variables?: Variable[];

  /**
   * Headers sent with every request in this folder.
   */
  headers?: KeyValue[];

  /**
   * User-Agent override for requests in this folder; empty inherits. Omitted in legacy exports.
   */
  userAgent?: string;

  /**
   * Default Authorization settings inherited by requests unless overridden.
   */
  auth?: AuthConfig;

  /**
   * JavaScript run before every request in this folder.
   */
  pre_request_script?: string;

  /**
   * JavaScript run after every request in this folder.
   */
  post_request_script?: string;

  /**
   * Ordered folder pre-request scripts when exported from a newer HarborClient build.
   */
  pre_request_scripts?: ScriptRef[];

  /**
   * Ordered folder post-request scripts when exported from a newer HarborClient build.
   */
  post_request_scripts?: ScriptRef[];

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
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
   * User-Agent override for requests in this collection; empty inherits global. Omitted in legacy exports.
   */
  userAgent?: string;

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
   * Ordered collection pre-request scripts when exported from a newer HarborClient build.
   */
  pre_request_scripts?: ScriptRef[];

  /**
   * Ordered collection post-request scripts when exported from a newer HarborClient build.
   */
  post_request_scripts?: ScriptRef[];

  /**
   * Folders for organizing requests within the collection.
   */
  folders?: ExportedFolder[];

  /**
   * Saved requests belonging to the collection.
   */
  requests: ExportedRequest[];

  /**
   * Markdown documents attached to the collection or its folders.
   */
  documents?: ExportedDocument[];

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
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
 * Whether an import created a new document or updated an existing one.
 */
export type ImportAction = 'created' | 'updated';

/**
 * Result of a unified File -> Import action that auto-detects export type.
 */
export type ImportFilePayload = {
  /**
   * Base file name including extension.
   */
  name: string;

  /**
   * Absolute path to the selected file.
   */
  path: string;

  /**
   * Normalized extension with a leading dot (for example `.json`).
   */
  extension: string;

  /**
   * Raw UTF-8 file contents.
   */
  contents: string;
};

/**
 * Result of a unified File -> Import action that auto-detects export type.
 */
export type ImportEntityResult =
  | { kind: 'collection'; collection: Collection; action: ImportAction }
  | { kind: 'request'; request: SavedRequest; action: ImportAction }
  | { kind: 'environment'; environment: Environment; action: ImportAction }
  | { kind: 'workspace'; workspaces: Workspace[]; action: ImportAction }
  | { kind: 'snippet'; snippet: Snippet; action: ImportAction }
  | { kind: 'theme'; theme: CustomTheme; action: ImportAction }
  | { kind: 'website'; website: Website; action: ImportAction }
  | { kind: 'run-results'; data: RunResultsExport }
  | { kind: 'openapi-spec'; file: ImportFilePayload }
  | { kind: 'plugin-file'; file: ImportFilePayload };
