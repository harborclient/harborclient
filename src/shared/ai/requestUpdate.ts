import { normalizeAuth, type AuthConfig } from '#/shared/auth';
import { applyParamsToUrl, mergeParamsFromUrl } from '#/shared/queryParams';
import { scriptRefsFromLegacyString } from '#/shared/scriptRefs';
import { parseFormParts, serializeFormParts } from '#/shared/formData';
import {
  generateMultipartBoundary,
  parseMultipartRaw,
  renderMultipartRaw
} from '#/shared/multipartRaw';
import { parseUrlEncodedParts, serializeUrlEncodedParts } from '#/shared/urlencoded';
import { rawUrlEncodedToRows, rowsToRawUrlEncoded } from '#/shared/urlencodedRaw';
import type { BodyType, HttpMethod, KeyValue } from '#/shared/types/common';
import type { ScriptRef } from '#/shared/types/script';

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
 * Returns an empty enabled key-value row for editor-style trailing rows.
 */
function emptyKeyValueRow(): KeyValue {
  return { key: '', value: '', enabled: true };
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
export function resolveEffectiveBodyRaw(draft: {
  body: string;
  body_type: BodyType;
  body_raw: string | null;
}): string | null {
  if (draft.body_raw != null) {
    return draft.body_raw;
  }

  if (draft.body_type === 'urlencoded') {
    return rowsToRawUrlEncoded(parseUrlEncodedParts(draft.body));
  }

  if (draft.body_type === 'multipart') {
    return renderMultipartRaw(parseFormParts(draft.body), generateMultipartBoundary());
  }

  return null;
}

/**
 * Best-effort syncs structured `body` from a verbatim raw override.
 *
 * @param bodyType - Active body type after the patch.
 * @param bodyRaw - Verbatim raw body text.
 * @returns Serialized structured body, or null when the body type does not use rows.
 */
function syncStructuredBodyFromRaw(bodyType: BodyType, bodyRaw: string): string | null {
  if (bodyType === 'urlencoded') {
    const rows = rawUrlEncodedToRows(bodyRaw);
    return serializeUrlEncodedParts(rows.length ? rows : [emptyKeyValueRow()]);
  }

  if (bodyType === 'multipart') {
    return serializeFormParts(parseMultipartRaw(bodyRaw).parts);
  }

  return null;
}

/**
 * Normalizes key-value input rows from the model into KeyValue entries.
 *
 * @param rows - Raw rows from tool arguments.
 * @returns Normalized KeyValue rows.
 */
function normalizeKeyValueInput(rows: AiKeyValueInput[]): KeyValue[] {
  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    enabled: row.enabled ?? true
  }));
}

/**
 * Ensures a key-value table ends with one blank trailing row like the request editor.
 *
 * @param rows - Key-value table rows.
 * @returns Rows with a trailing blank row when needed.
 */
function ensureTrailingBlankRow(rows: KeyValue[]): KeyValue[] {
  if (rows.length === 0) {
    return [emptyKeyValueRow()];
  }

  const last = rows[rows.length - 1];
  if (last.key.trim() !== '' || last.value.trim() !== '') {
    return [...rows, emptyKeyValueRow()];
  }

  return rows;
}

/**
 * Merges or replaces key-value rows by trimmed key (case-sensitive).
 *
 * @param current - Existing table rows.
 * @param patch - Incoming rows from the tool.
 * @param mode - Merge upserts by key; replace uses patch as the new table.
 * @returns Updated key-value table with a trailing blank row.
 */
export function mergeKeyValues(
  current: KeyValue[],
  patch: AiKeyValueInput[],
  mode: KeyValueListMode = 'merge'
): KeyValue[] {
  const normalizedPatch = normalizeKeyValueInput(patch);

  if (mode === 'replace') {
    return ensureTrailingBlankRow(normalizedPatch);
  }

  const next = current.filter((row) => row.key.trim() !== '' || row.value.trim() !== '');
  for (const incoming of normalizedPatch) {
    const key = incoming.key.trim();
    if (!key) {
      continue;
    }

    const index = next.findIndex((row) => row.key.trim() === key);
    if (index === -1) {
      next.push(incoming);
    } else {
      next[index] = incoming;
    }
  }

  return ensureTrailingBlankRow(next);
}

/**
 * Applies replace or append semantics to a script field.
 *
 * @param current - Existing script text.
 * @param next - New script text from the tool.
 * @param mode - Replace overwrites; append adds after existing content with a newline.
 * @returns Updated script string.
 */
export function applyScriptUpdate(
  current: string,
  next: string,
  mode: ScriptUpdateMode = 'replace'
): string {
  if (mode === 'append') {
    const trimmedCurrent = current.trimEnd();
    if (!trimmedCurrent) {
      return next;
    }
    if (!next.trim()) {
      return current;
    }
    return `${trimmedCurrent}\n${next}`;
  }

  return next;
}

/**
 * Shallow-merges a partial auth patch into the current auth config.
 *
 * @param current - Existing auth configuration.
 * @param patch - Partial auth update from the tool.
 * @returns Merged auth configuration.
 */
export function applyAuthPatch(current: AuthConfig, patch: AiAuthPatch): AuthConfig {
  return normalizeAuth({
    type: patch.type ?? current.type,
    basic: {
      ...current.basic,
      ...patch.basic
    },
    bearer: {
      ...current.bearer,
      ...patch.bearer
    },
    oauth2: {
      ...current.oauth2,
      ...patch.oauth2
    }
  });
}

/**
 * Returns whether the update args include at least one supported field.
 *
 * @param args - Parsed tool arguments.
 */
export function hasRequestUpdateFields(args: UpdateActiveRequestToolArgs): boolean {
  return (
    args.name !== undefined ||
    args.method !== undefined ||
    args.url !== undefined ||
    args.body !== undefined ||
    args.body_type !== undefined ||
    args.body_raw !== undefined ||
    args.pre_request_script !== undefined ||
    args.post_request_script !== undefined ||
    args.comment !== undefined ||
    args.headers !== undefined ||
    args.params !== undefined ||
    args.auth !== undefined ||
    args.cookies !== undefined
  );
}

/**
 * Applies a partial update patch to a request draft, syncing URL and params like the editor.
 *
 * @param draft - Current request draft from the active tab.
 * @param args - Parsed update_active_request tool arguments.
 * @returns Updated draft, changed field names, and optional cookie rows for IPC.
 */
export function applyRequestDraftUpdate(
  draft: AiRequestDraft,
  args: UpdateActiveRequestToolArgs
): ApplyRequestDraftUpdateResult {
  const changedFields: string[] = [];
  const next: AiRequestDraft = { ...draft };

  if (args.name !== undefined) {
    next.name = args.name;
    changedFields.push('name');
  }

  if (args.method !== undefined) {
    next.method = args.method;
    changedFields.push('method');
  }

  if (args.body !== undefined) {
    next.body = args.body;
    changedFields.push('body');
  }

  if (args.body_type !== undefined) {
    next.body_type = args.body_type;
    changedFields.push('body_type');
    // Match the request editor: switching body type clears a stale raw override unless
    // the same patch also sets body_raw.
    if (args.body_raw === undefined && next.body_raw != null) {
      next.body_raw = null;
      changedFields.push('body_raw');
    }
  }

  if (args.body_raw !== undefined) {
    next.body_raw = args.body_raw;
    changedFields.push('body_raw');
    if (args.body_raw != null) {
      if (!next.body_raw_open) {
        next.body_raw_open = true;
        changedFields.push('body_raw_open');
      }
      // When the model only patches body_raw, refresh structured rows like the Raw drawer.
      if (args.body === undefined) {
        const synced = syncStructuredBodyFromRaw(next.body_type, args.body_raw);
        if (synced != null) {
          next.body = synced;
          changedFields.push('body');
        }
      }
    }
  }

  if (args.comment !== undefined) {
    next.comment = args.comment;
    changedFields.push('comment');
  }

  if (args.pre_request_script !== undefined) {
    next.pre_request_script = applyScriptUpdate(
      next.pre_request_script,
      args.pre_request_script,
      args.pre_request_script_mode ?? 'replace'
    );
    next.pre_request_scripts = scriptRefsFromLegacyString(next.pre_request_script);
    changedFields.push('pre_request_script');
  }

  if (args.post_request_script !== undefined) {
    next.post_request_script = applyScriptUpdate(
      next.post_request_script,
      args.post_request_script,
      args.post_request_script_mode ?? 'replace'
    );
    next.post_request_scripts = scriptRefsFromLegacyString(next.post_request_script);
    changedFields.push('post_request_script');
  }

  if (args.auth !== undefined) {
    next.auth = applyAuthPatch(next.auth, args.auth);
    changedFields.push('auth');
  }

  if (args.url !== undefined) {
    next.url = args.url;
    changedFields.push('url');
  }

  if (args.params !== undefined) {
    next.params = mergeKeyValues(next.params, args.params, args.params_mode ?? 'merge');
    next.url = applyParamsToUrl(next.url, next.params);
    changedFields.push('params');
    if (!changedFields.includes('url')) {
      changedFields.push('url');
    }
  } else if (args.url !== undefined) {
    next.params = mergeParamsFromUrl(next.url, next.params);
    changedFields.push('params');
  }

  if (args.headers !== undefined) {
    next.headers = mergeKeyValues(next.headers, args.headers, args.headers_mode ?? 'merge');
    changedFields.push('headers');
  }

  let hasCookieUpdate = false;
  if (args.cookies !== undefined) {
    hasCookieUpdate = true;
    changedFields.push('cookies');
  }

  return {
    draft: next,
    changedFields,
    hasCookieUpdate
  };
}
