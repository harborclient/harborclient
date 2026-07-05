import { cleanVariables } from '@harborclient/sdk/components';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { mirrorLegacyScriptString, normalizeScriptRefsForCompare } from '#/shared/scriptRefs';

/**
 * Drops header rows with no key or value content.
 *
 * @param headers - Raw header rows from a form.
 */
export const cleanHeaders = (headers: KeyValue[]): KeyValue[] =>
  headers.filter((h) => h.key.trim() || h.value.trim());

/**
 * Serializes collection form fields for dirty-state comparison and persistence.
 */
export const serializeCollectionForm = (
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScripts: ScriptRef[],
  postRequestScripts: ScriptRef[],
  auth: AuthConfig,
  connectionId: string
): string =>
  JSON.stringify({
    name: name.trim(),
    variables: cleanVariables(variables),
    headers: cleanHeaders(headers),
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: normalizeScriptRefsForCompare(preRequestScripts),
    post_request_scripts: normalizeScriptRefsForCompare(postRequestScripts),
    auth,
    connectionId
  });
