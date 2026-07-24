import { type AuthConfig } from '../auth';
import type { BodyType, HttpMethod, KeyValue } from '../types/common';
import type { ScriptRef } from '../types/script';
/**
 * Merge mode for key-value lists such as headers, params, and cookies.
 */
export type KeyValueListMode = 'merge' | 'replace';
/**
 * Replace or append mode for pre/post request script fields.
 */
export type ScriptUpdateMode = 'replace' | 'append';
/**
 * Request draft fields the AI update tool can modify.
 */
export interface AiRequestDraft {
  /**
   * Display name for the request tab.
   */
  name: string;
  /**
   * HTTP method for the request.
   */
  method: HttpMethod;
  /**
   * Request URL including optional query string and hash.
   */
  url: string;
  /**
   * Request headers table rows.
   */
  headers: KeyValue[];
  /**
   * Query params table rows.
   */
  params: KeyValue[];
  /**
   * Request-level authorization settings.
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
   * Verbatim Raw body override; null when the structured editor is authoritative.
   */
  body_raw: string | null;
  /**
   * When true, the Raw body drawer is open in the request editor.
   */
  body_raw_open: boolean;
  /**
   * JavaScript run before the request is sent.
   */
  pre_request_script: string;
  /**
   * JavaScript run after the response is received.
   */
  post_request_script: string;
  /**
   * Ordered pre-request scripts for the editor.
   */
  pre_request_scripts: ScriptRef[];
  /**
   * Ordered post-request scripts for the editor.
   */
  post_request_scripts: ScriptRef[];
  /**
   * Free-form notes for the request.
   */
  comment: string;
  /**
   * Comma-separated tags for organizing requests.
   */
  tags: string;
}
/**
 * Partial auth patch accepted by the update tool.
 */
export interface AiAuthPatch {
  /**
   * Selected auth mode.
   */
  type?: AuthConfig['type'];
  /**
   * Basic auth credentials.
   */
  basic?: Partial<AuthConfig['basic']>;
  /**
   * Bearer token credentials.
   */
  bearer?: Partial<AuthConfig['bearer']>;
  /**
   * OAuth 2.0 Client Credentials settings.
   */
  oauth2?: Partial<AuthConfig['oauth2']>;
}
/**
 * Key-value row input from the model; enabled defaults to true.
 */
export interface AiKeyValueInput {
  /**
   * Header, param, or cookie name.
   */
  key: string;
  /**
   * Header, param, or cookie value.
   */
  value: string;
  /**
   * Whether the row is active; defaults to true when omitted.
   */
  enabled?: boolean;
}
/**
 * Arguments for the update_active_request tool.
 */
export interface UpdateActiveRequestToolArgs {
  /**
   * New display name for the request.
   */
  name?: string;
  /**
   * HTTP method for the request.
   */
  method?: HttpMethod;
  /**
   * Request URL; when changed without params, the params table syncs from the query string.
   */
  url?: string;
  /**
   * Request body content.
   */
  body?: string;
  /**
   * Content type of the request body.
   */
  body_type?: BodyType;
  /**
   * Verbatim Raw body override for multipart/urlencoded. Pass a string to set the
   * override (authoritative at send time) and best-effort sync structured rows; pass
   * null to clear the override and restore structured-row projection.
   */
  body_raw?: string | null;
  /**
   * Pre-request script content.
   */
  pre_request_script?: string;
  /**
   * How to apply pre_request_script; defaults to replace.
   */
  pre_request_script_mode?: ScriptUpdateMode;
  /**
   * Post-request script content.
   */
  post_request_script?: string;
  /**
   * How to apply post_request_script; defaults to replace.
   */
  post_request_script_mode?: ScriptUpdateMode;
  /**
   * Free-form notes for the request.
   */
  comment?: string;
  /**
   * Request headers to merge or replace.
   */
  headers?: AiKeyValueInput[];
  /**
   * How to apply headers; defaults to merge.
   */
  headers_mode?: KeyValueListMode;
  /**
   * Query params to merge or replace.
   */
  params?: AiKeyValueInput[];
  /**
   * How to apply params; defaults to merge.
   */
  params_mode?: KeyValueListMode;
  /**
   * Partial auth settings patch.
   */
  auth?: AiAuthPatch;
  /**
   * Cookies for the request host; applied via the cookie jar, not stored on the draft.
   */
  cookies?: AiKeyValueInput[];
  /**
   * How to apply cookies; defaults to merge.
   */
  cookies_mode?: KeyValueListMode;
}
/**
 * Result of applying an update patch to a request draft.
 */
export interface ApplyRequestDraftUpdateResult {
  /**
   * Updated draft after applying the patch.
   */
  draft: AiRequestDraft;
  /**
   * Names of fields that were changed on the draft.
   */
  changedFields: string[];
  /**
   * Whether cookies were included in the patch (handled separately by the executor).
   */
  hasCookieUpdate: boolean;
}
/**
 * Resolves the effective raw body wire text for AI reads.
 *
 * When `body_raw` is set it is returned as-is. Otherwise multipart/urlencoded drafts
 * project structured rows into wire text; other body types return null.
 *
 * @param draft - Request draft fields needed for projection.
 * @returns Effective raw body text, or null when not applicable.
 */
export declare function resolveEffectiveBodyRaw(draft: {
  body: string;
  body_type: BodyType;
  body_raw: string | null;
}): string | null;
/**
 * Merges or replaces key-value rows by trimmed key (case-sensitive).
 *
 * @param current - Existing table rows.
 * @param patch - Incoming rows from the tool.
 * @param mode - Merge upserts by key; replace uses patch as the new table.
 * @returns Updated key-value table with a trailing blank row.
 */
export declare function mergeKeyValues(
  current: KeyValue[],
  patch: AiKeyValueInput[],
  mode?: KeyValueListMode
): KeyValue[];
/**
 * Applies replace or append semantics to a script field.
 *
 * @param current - Existing script text.
 * @param next - New script text from the tool.
 * @param mode - Replace overwrites; append adds after existing content with a newline.
 * @returns Updated script string.
 */
export declare function applyScriptUpdate(
  current: string,
  next: string,
  mode?: ScriptUpdateMode
): string;
/**
 * Shallow-merges a partial auth patch into the current auth config.
 *
 * @param current - Existing auth configuration.
 * @param patch - Partial auth update from the tool.
 * @returns Merged auth configuration.
 */
export declare function applyAuthPatch(current: AuthConfig, patch: AiAuthPatch): AuthConfig;
/**
 * Returns whether the update args include at least one supported field.
 *
 * @param args - Parsed tool arguments.
 */
export declare function hasRequestUpdateFields(args: UpdateActiveRequestToolArgs): boolean;
/**
 * Applies a partial update patch to a request draft, syncing URL and params like the editor.
 *
 * @param draft - Current request draft from the active tab.
 * @param args - Parsed update_active_request tool arguments.
 * @returns Updated draft, changed field names, and optional cookie rows for IPC.
 */
export declare function applyRequestDraftUpdate(
  draft: AiRequestDraft,
  args: UpdateActiveRequestToolArgs
): ApplyRequestDraftUpdateResult;
//# sourceMappingURL=requestUpdate.d.ts.map
