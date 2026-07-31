import { cleanVariables } from '@harborclient/sdk/components';
import type { KeyValue, Variable } from '@harborclient/core/types';
import {
  mirrorLegacyScriptString,
  normalizeScriptRefsForCompare
} from '@harborclient/core/scriptRefs';
import { emptyKeyValue, type ScopedSettingsDraft } from '#/renderer/src/store/tabs';

/**
 * Core editable fields shared by collection and folder settings forms.
 */
export type ScopedSettingsCoreFields = ScopedSettingsDraft;

/**
 * Drops header rows with no key or value content.
 *
 * @param headers - Raw header rows from a form.
 * @returns Header rows that have a non-empty key or value.
 */
export const cleanHeaders = (headers: KeyValue[]): KeyValue[] =>
  headers.filter((h) => h.key.trim() || h.value.trim());

/**
 * Seeds variables state with a blank row when the persisted list is empty.
 *
 * @param variables - Persisted or draft variable rows.
 * @returns Variables suitable for editor state initialization.
 */
export const seedScopedSettingsVariables = (variables: Variable[]): Variable[] =>
  variables.length
    ? variables
    : [{ key: '', value: '', defaultValue: '', enabled: true, share: false }];

/**
 * Seeds headers state with a blank row when the persisted list is empty.
 *
 * @param headers - Persisted or draft header rows.
 * @returns Headers suitable for editor state initialization.
 */
export const seedScopedSettingsHeaders = (headers: KeyValue[]): KeyValue[] =>
  headers.length ? headers : [emptyKeyValue()];

/**
 * Serializes scoped settings core fields for dirty-state comparison.
 *
 * @param fields - Core form fields to serialize.
 * @returns Stable JSON string for equality checks.
 */
export const serializeScopedSettingsForm = (fields: ScopedSettingsCoreFields): string =>
  JSON.stringify({
    name: fields.name.trim(),
    variables: cleanVariables(fields.variables),
    headers: cleanHeaders(fields.headers),
    userAgent: fields.userAgent.trim(),
    pre_request_script: mirrorLegacyScriptString(fields.preRequestScripts),
    post_request_script: mirrorLegacyScriptString(fields.postRequestScripts),
    pre_request_scripts: normalizeScriptRefsForCompare(fields.preRequestScripts),
    post_request_scripts: normalizeScriptRefsForCompare(fields.postRequestScripts),
    auth: fields.auth
  });

/**
 * Returns cleaned core fields ready for persistence.
 *
 * @param fields - Raw draft form fields.
 * @returns Trimmed name and cleaned variable/header rows.
 */
export const cleanScopedSettingsCoreFields = (
  fields: ScopedSettingsCoreFields
): ScopedSettingsCoreFields => ({
  ...fields,
  name: fields.name.trim(),
  variables: cleanVariables(fields.variables),
  headers: cleanHeaders(fields.headers),
  userAgent: fields.userAgent.trim()
});
