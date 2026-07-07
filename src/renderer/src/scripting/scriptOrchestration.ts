import type { ScriptRequestContext, ScriptRunResult, Variable, KeyValue } from '#/shared/types';
import { resolveDynamicVariable, VARIABLE_TOKEN_PATTERN } from '@harborclient/sdk/variables';
import type { ScriptRef, Snippet } from '#/shared/types';
import { buildScopedScriptSlots, type ScriptSlot } from '#/renderer/src/scripting/scriptResolution';

export type { ScriptSlot };

/**
 * Builds a runtime variable map from collection variables.
 *
 * @param variables - Collection-scoped variables.
 * @returns Map of trimmed keys to resolved values.
 */
export function buildRuntimeVars(variables: Variable[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const variable of variables) {
    const key = variable.key.trim();
    if (!key) continue;
    map[key] = variable.value !== '' ? variable.value : variable.defaultValue;
  }
  return map;
}

/**
 * Replaces {{key}} placeholders using a runtime variable map.
 *
 * Runtime variables take precedence over dynamic variables. Unknown tokens are left unchanged.
 *
 * @param text - Text containing variable placeholders.
 * @param runtimeVars - Current runtime variable values.
 * @returns Text with known variables substituted.
 */
export function substituteWithMap(text: string, runtimeVars: Record<string, string>): string {
  const pattern = new RegExp(VARIABLE_TOKEN_PATTERN.source, 'g');

  return text.replace(pattern, (match, key: string) => {
    const value = runtimeVars[key];
    if (value !== undefined) {
      return value;
    }
    const dynamic = resolveDynamicVariable(key);
    return dynamic !== undefined ? dynamic : match;
  });
}

/**
 * Merges ephemeral variable sets from a script run into the runtime map.
 *
 * @param runtimeVars - Current runtime variables.
 * @param variableSets - New values set by hc.request.variables.set or hc.collection.variables.set.
 * @returns Updated runtime variable map.
 */
export function mergeVariableSets(
  runtimeVars: Record<string, string>,
  variableSets: Record<string, string>
): Record<string, string> {
  return { ...runtimeVars, ...variableSets };
}

/**
 * Removes cleared keys from a runtime variable map.
 *
 * @param runtimeVars - Current runtime variables.
 * @param clears - Keys removed via hc.*.variables.clear or hc.globals.clear during send.
 * @returns Updated runtime variable map without cleared keys.
 */
export function applyRuntimeVariableClears(
  runtimeVars: Record<string, string>,
  clears: string[]
): Record<string, string> {
  if (clears.length === 0) {
    return runtimeVars;
  }
  const clearSet = new Set(clears.map((key) => key.trim()).filter(Boolean));
  const next = { ...runtimeVars };
  for (const key of clearSet) {
    delete next[key];
  }
  return next;
}

/**
 * Removes cleared keys from a persisted variable list.
 *
 * @param variables - Current collection, environment, or global variable rows.
 * @param clears - Keys removed via hc.*.variables.clear or hc.globals.clear during send.
 * @returns Variable list with cleared keys removed.
 */
export function applyVariableClears(variables: Variable[], clears: string[]): Variable[] {
  if (clears.length === 0) {
    return variables;
  }
  const clearSet = new Set(clears.map((key) => key.trim().toLowerCase()).filter(Boolean));
  return variables.filter((variable) => !clearSet.has(variable.key.trim().toLowerCase()));
}

/**
 * Applies script-set collection variable values onto a collection variable list.
 *
 * Updates existing keys in place and appends new rows for keys not yet defined.
 *
 * @param variables - Current collection-scoped variables.
 * @param collectionVariableSets - Values set via hc.collection.variables.set during send.
 * @returns Updated collection variable list.
 */
export function applyCollectionVariableSets(
  variables: Variable[],
  collectionVariableSets: Record<string, string>
): Variable[] {
  const updated = variables.map((variable) => ({ ...variable }));
  const indexByKey = new Map<string, number>();
  for (let i = 0; i < updated.length; i++) {
    const key = updated[i].key.trim();
    if (key) {
      indexByKey.set(key, i);
    }
  }

  for (const [rawKey, value] of Object.entries(collectionVariableSets)) {
    const key = rawKey.trim();
    if (!key) continue;

    const existingIndex = indexByKey.get(key);
    if (existingIndex !== undefined) {
      updated[existingIndex] = { ...updated[existingIndex], value };
    } else {
      updated.push({ key, value, defaultValue: '', share: false });
    }
  }

  return updated;
}

/**
 * Applies script cookie mutations onto seeded cookie rows for the request host.
 *
 * @param cookies - Cookie rows loaded for the request host at send start.
 * @param cookieSets - Values set via hc.cookies.set during send.
 * @param cookieClears - Names cleared via hc.cookies.clear during send.
 * @returns Updated cookie rows ready for persistence.
 */
export function applyCookieChanges(
  cookies: KeyValue[],
  cookieSets: Record<string, string>,
  cookieClears: string[]
): KeyValue[] {
  let rows = cookies.map((cookie) => ({ ...cookie }));

  if (cookieClears.length > 0) {
    const clearSet = new Set(cookieClears.map((name) => name.trim().toLowerCase()).filter(Boolean));
    rows = rows.filter((cookie) => !clearSet.has(cookie.key.trim().toLowerCase()));
  }

  if (Object.keys(cookieSets).length === 0) {
    return rows;
  }

  const indexByKey = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const key = rows[i].key.trim();
    if (key) {
      indexByKey.set(key.toLowerCase(), i);
    }
  }

  for (const [rawName, value] of Object.entries(cookieSets)) {
    const name = rawName.trim();
    if (!name) continue;

    const existingIndex = indexByKey.get(name.toLowerCase());
    if (existingIndex !== undefined) {
      rows[existingIndex] = { ...rows[existingIndex], value, enabled: true };
    } else {
      rows.push({ key: name, value, enabled: true });
    }
  }

  return rows;
}

/**
 * Applies sandbox request mutations onto a working request context.
 *
 * @param current - Current request context.
 * @param result - Script run result with mutated request.
 * @returns Updated request context.
 */
export function applyScriptRequestMutations(
  current: ScriptRequestContext,
  result: ScriptRunResult
): ScriptRequestContext {
  return {
    method: result.request.method,
    url: result.request.url,
    headers: result.request.headers.map((header) => ({ ...header })),
    params: current.params,
    body: result.request.body,
    bodyType: current.bodyType,
    auth: result.request.auth
  };
}

/**
 * Builds the ordered list of scripts to run for a send operation.
 *
 * Collection scripts run before request scripts within each phase. Each scope
 * expands its script reference array (with legacy string fallback) and resolves
 * live snippet references at send time.
 *
 * @param collectionPreScripts - Collection pre-request script references.
 * @param collectionPostScripts - Collection post-request script references.
 * @param requestPreScripts - Request pre-request script references.
 * @param requestPostScripts - Request post-request script references.
 * @param collectionPreLegacy - Legacy collection pre-request script string.
 * @param collectionPostLegacy - Legacy collection post-request script string.
 * @param requestPreLegacy - Legacy request pre-request script string.
 * @param requestPostLegacy - Legacy request post-request script string.
 * @param phase - Which phase to collect.
 * @param snippetLookup - Live snippet library lookup by uuid.
 * @returns Ordered script slots for the phase.
 */
export function buildScriptSlots(
  collectionPreScripts: ScriptRef[] | undefined | null,
  collectionPostScripts: ScriptRef[] | undefined | null,
  requestPreScripts: ScriptRef[] | undefined | null,
  requestPostScripts: ScriptRef[] | undefined | null,
  collectionPreLegacy: string,
  collectionPostLegacy: string,
  requestPreLegacy: string,
  requestPostLegacy: string,
  phase: 'pre' | 'post',
  snippetLookup: Map<string, Snippet>
): ScriptSlot[] {
  if (phase === 'pre') {
    return [
      ...buildScopedScriptSlots(
        collectionPreScripts,
        collectionPreLegacy,
        'pre',
        'Collection pre-request',
        snippetLookup
      ),
      ...buildScopedScriptSlots(
        requestPreScripts,
        requestPreLegacy,
        'pre',
        'Request pre-request',
        snippetLookup
      )
    ];
  }

  return [
    ...buildScopedScriptSlots(
      collectionPostScripts,
      collectionPostLegacy,
      'post',
      'Collection post-request',
      snippetLookup
    ),
    ...buildScopedScriptSlots(
      requestPostScripts,
      requestPostLegacy,
      'post',
      'Request post-request',
      snippetLookup
    )
  ];
}
