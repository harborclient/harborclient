import type { KeyValue, Variable } from '#/shared/types';
import { buildSendUrl } from '#/shared/queryParams';

import { buildRuntimeVars, substituteWithMap } from '#/renderer/src/scripting/scriptOrchestration';

/**
 * Builds the runtime variable map used when resolving a saved request URL at send time.
 *
 * Globals load first, then collection variables, then environment variables. When multiple
 * scopes define the same key, environment wins.
 *
 * @param globalVariables - App-wide variables from Settings → Globals.
 * @param collectionVariables - Variables from the request's collection.
 * @param environmentVariables - Variables from the active environment, if any.
 * @returns Map of variable keys to resolved string values.
 */
export function buildSendRuntimeVars(
  globalVariables: Variable[],
  collectionVariables: Variable[],
  environmentVariables: Variable[]
): Record<string, string> {
  return {
    ...buildRuntimeVars(globalVariables),
    ...buildRuntimeVars(collectionVariables),
    ...buildRuntimeVars(environmentVariables)
  };
}

/**
 * Resolves a saved request URL and params into the outbound URL used at send time.
 *
 * Substitutes static and dynamic placeholders, then merges enabled query params. Does not
 * run pre-request scripts.
 *
 * @param url - Saved request URL, possibly containing placeholders.
 * @param params - Saved request query param rows.
 * @param runtimeVars - Merged global, collection, and environment variable map.
 * @returns Fully resolved URL with query string.
 */
export function resolveRequestUrl(
  url: string,
  params: KeyValue[],
  runtimeVars: Record<string, string>
): string {
  const resolvedUrl = substituteWithMap(url, runtimeVars);
  const resolvedParams = params.map((param) => ({
    ...param,
    value: substituteWithMap(param.value, runtimeVars)
  }));
  return buildSendUrl(resolvedUrl, resolvedParams);
}
