import type { AuthConfig, KeyValue, ScriptRef, Variable } from '#/shared/types';
import {
  cleanHeaders,
  serializeScopedSettingsForm,
  type ScopedSettingsCoreFields
} from '#/renderer/src/ui/Shared/ScopedSettings/scopedSettingsForm';

export { cleanHeaders, serializeScopedSettingsForm };

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
    ...JSON.parse(
      serializeScopedSettingsForm({
        name,
        variables,
        headers,
        preRequestScripts,
        postRequestScripts,
        auth
      })
    ),
    connectionId
  });

/**
 * Builds core fields from discrete collection form arguments for serialization.
 *
 * @param name - Collection display name.
 * @param variables - Collection variables.
 * @param headers - Collection headers.
 * @param preRequestScripts - Pre-request script refs.
 * @param postRequestScripts - Post-request script refs.
 * @param auth - Authorization settings.
 * @returns Core fields object for scoped serialization.
 */
export const collectionFormCoreFields = (
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScripts: ScriptRef[],
  postRequestScripts: ScriptRef[],
  auth: AuthConfig
): ScopedSettingsCoreFields => ({
  name,
  variables,
  headers,
  preRequestScripts,
  postRequestScripts,
  auth
});
