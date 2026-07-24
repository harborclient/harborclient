import { normalizeAuth } from '../auth';
import { applyParamsToUrl, mergeParamsFromUrl } from '../queryParams';
import { scriptRefsFromLegacyString } from '../scriptRefs';
import { parseFormParts, serializeFormParts } from '../formData';
import { generateMultipartBoundary, parseMultipartRaw, renderMultipartRaw } from '../multipartRaw';
import { parseUrlEncodedParts, serializeUrlEncodedParts } from '../urlencoded';
import { rawUrlEncodedToRows, rowsToRawUrlEncoded } from '../urlencodedRaw';
/**
 * Returns an empty enabled key-value row for editor-style trailing rows.
 */
function emptyKeyValueRow() {
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
export function resolveEffectiveBodyRaw(draft) {
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
function syncStructuredBodyFromRaw(bodyType, bodyRaw) {
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
function normalizeKeyValueInput(rows) {
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
function ensureTrailingBlankRow(rows) {
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
export function mergeKeyValues(current, patch, mode = 'merge') {
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
export function applyScriptUpdate(current, next, mode = 'replace') {
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
export function applyAuthPatch(current, patch) {
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
export function hasRequestUpdateFields(args) {
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
export function applyRequestDraftUpdate(draft, args) {
  const changedFields = [];
  const next = { ...draft };
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
//# sourceMappingURL=requestUpdate.js.map
