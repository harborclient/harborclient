import type { AuthConfig, KeyValue, ScriptRef, Variable } from '@harborclient/core/types';
import {
  cleanHeaders,
  serializeScopedSettingsForm,
  type ScopedSettingsCoreFields
} from '#/renderer/src/ui/Shared/ScopedSettings/scopedSettingsCore';

export { cleanHeaders, serializeScopedSettingsForm };

/**
 * Serializes folder form fields for dirty-state comparison and persistence.
 */
export const serializeFolderForm = (
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  userAgent: string,
  preRequestScripts: ScriptRef[],
  postRequestScripts: ScriptRef[],
  auth: AuthConfig
): string =>
  serializeScopedSettingsForm({
    name,
    variables,
    headers,
    userAgent,
    preRequestScripts,
    postRequestScripts,
    auth
  });

/**
 * Builds core fields from discrete folder form arguments for serialization.
 *
 * @param name - Folder display name.
 * @param variables - Folder variables.
 * @param headers - Folder headers.
 * @param userAgent - Folder User-Agent override.
 * @param preRequestScripts - Pre-request script refs.
 * @param postRequestScripts - Post-request script refs.
 * @param auth - Authorization settings.
 * @returns Core fields object for scoped serialization.
 */
export const folderFormCoreFields = (
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  userAgent: string,
  preRequestScripts: ScriptRef[],
  postRequestScripts: ScriptRef[],
  auth: AuthConfig
): ScopedSettingsCoreFields => ({
  name,
  variables,
  headers,
  userAgent,
  preRequestScripts,
  postRequestScripts,
  auth
});
