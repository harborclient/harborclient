import { cleanVariables } from '@harborclient/sdk/components';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { mirrorLegacyScriptString, normalizeScriptRefsForCompare } from '#/shared/scriptRefs';
import { cleanHeaders } from '#/renderer/src/ui/CollectionSettings/serialize';

export { cleanHeaders };

/**
 * Serializes folder form fields for dirty-state comparison and persistence.
 */
export const serializeFolderForm = (
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScripts: ScriptRef[],
  postRequestScripts: ScriptRef[],
  auth: AuthConfig
): string =>
  JSON.stringify({
    name: name.trim(),
    variables: cleanVariables(variables),
    headers: cleanHeaders(headers),
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: normalizeScriptRefsForCompare(preRequestScripts),
    post_request_scripts: normalizeScriptRefsForCompare(postRequestScripts),
    auth
  });
