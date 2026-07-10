import type { AuthConfig } from '#/shared/auth';
import type { RunResultsExport } from '#/shared/collectionRunner';
import type { CustomTheme } from '#/shared/types/customTheme';
import type { Environment } from '#/shared/types/environment';
import type { SavedRequest } from '#/shared/types/request';
import type { Snippet } from '#/shared/types/snippet';
import type { ScriptRef } from '#/shared/types/script';
import type { BodyType, HttpMethod, KeyValue, Variable } from '#/shared/types/common';

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
   * Folder-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];

  /**
   * Headers sent with every request in this folder.
   */
  headers: KeyValue[];

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

  /**
   * Folder-scoped variables for {{key}} substitution in requests.
   */
  variables?: Variable[];

  /**
   * Headers sent with every request in this folder.
   */
  headers?: KeyValue[];

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
export type ImportEntityResult =
  | { kind: 'collection'; collection: Collection; action: ImportAction }
  | { kind: 'request'; request: SavedRequest; action: ImportAction }
  | { kind: 'environment'; environment: Environment; action: ImportAction }
  | { kind: 'snippet'; snippet: Snippet; action: ImportAction }
  | { kind: 'theme'; theme: CustomTheme; action: ImportAction }
  | { kind: 'run-results'; data: RunResultsExport };
