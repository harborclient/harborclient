import type { AuthConfig } from '#/shared/auth';
import type { BodyType, HttpMethod, KeyValue } from '#/shared/types/common';
import type { ScriptRef } from '#/shared/types/script';

export type {
  RedirectHop,
  RequestTimingPhases,
  SendRequestInput,
  SendResult,
  SentRequest
} from '@harborclient/http';

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
   * Ordered pre-request scripts; canonical source when non-empty.
   */
  pre_request_scripts: ScriptRef[];

  /**
   * Ordered post-request scripts; canonical source when non-empty.
   */
  post_request_scripts: ScriptRef[];

  /**
   * Free-form notes for this request.
   */
  comment: string;

  /**
   * Comma-separated labels for organizing and searching requests.
   */
  tags: string;

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
   * Ordered pre-request scripts; canonical source when non-empty.
   */
  pre_request_scripts?: ScriptRef[];

  /**
   * Ordered post-request scripts; canonical source when non-empty.
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
   * Ordered pre-request scripts; canonical source when non-empty.
   */
  pre_request_scripts?: ScriptRef[];

  /**
   * Ordered post-request scripts; canonical source when non-empty.
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
   * ID of the folder containing this request, or null when at collection root.
   */
  folder_id?: number | null;
}
