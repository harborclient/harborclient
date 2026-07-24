import {
  buildAuthHeaderValue,
  buildOAuthAuthHeaderValue,
  buildOAuthCacheKey,
  defaultAuth,
  resolveAuthVariables,
  type AuthConfig
} from '../auth';
import { applyBodyRawOverride } from '../bodyRawSend';
import type { KeyValue, ScriptRequestContext, SendRequestInput, Variable } from '../types';
import { substituteVariablesFromMap } from '@harborclient/sdk/variables';
import type { RequestRunnerDeps, RunRequestInput } from './types';

/**
 * Builds a variable map from editable rows, using a default when the value is empty.
 *
 * @param variables - Rows from one variable scope.
 * @returns Trimmed variable keys and their effective values.
 */
export function buildRuntimeVariables(variables: Variable[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const variable of variables) {
    const key = variable.key.trim();
    if (key) {
      values[key] = variable.value !== '' ? variable.value : variable.defaultValue;
    }
  }
  return values;
}

/**
 * Resolves known {{variable}} placeholders while preserving unknown placeholders.
 *
 * @param text - Source text that may contain variable placeholders.
 * @param variables - Effective runtime variable values.
 * @returns Text with known variable references substituted.
 */
export function substituteRequestVariables(
  text: string,
  variables: Record<string, string>
): string {
  return substituteVariablesFromMap(text, variables);
}

/**
 * Combines variable scopes in increasing precedence order.
 *
 * @param input - Request run input containing optional variable scopes.
 * @returns Effective variables used by scripts and the HTTP request.
 */
export function resolveRequestVariables(input: RunRequestInput): Record<string, string> {
  return {
    ...buildRuntimeVariables(input.globalVariables ?? []),
    ...buildRuntimeVariables(input.collection?.variables ?? []),
    ...buildRuntimeVariables(input.folder?.variables ?? []),
    ...buildRuntimeVariables(input.environment?.variables ?? [])
  };
}

/**
 * Selects request auth first, then folder auth, then collection auth.
 *
 * @param requestAuth - Auth configured directly on the request.
 * @param folderAuth - Auth inherited from the containing folder.
 * @param collectionAuth - Auth inherited from the containing collection.
 * @returns Auth configuration that applies to the outgoing request.
 */
export function resolveEffectiveAuth(
  requestAuth: AuthConfig | undefined,
  folderAuth: AuthConfig | undefined,
  collectionAuth: AuthConfig | undefined
): AuthConfig {
  if (requestAuth?.type && requestAuth.type !== 'none') {
    return requestAuth;
  }
  if (folderAuth?.type && folderAuth.type !== 'none') {
    return folderAuth;
  }
  return collectionAuth ?? defaultAuth();
}

/**
 * Determines whether a user-provided header overrides generated authentication.
 *
 * @param headers - All inherited and request-specific headers.
 * @returns True when a non-empty Authorization header is already enabled.
 */
export function hasManualAuthorizationHeader(headers: KeyValue[]): boolean {
  return headers.some(
    (header) =>
      header.enabled &&
      header.key.trim().toLowerCase() === 'authorization' &&
      header.value.trim() !== ''
  );
}

/**
 * Produces the portable outbound request from a script-mutated request context.
 *
 * @param input - Request scope, identity, and raw-body override data.
 * @param request - Request state after pre-request scripts have run.
 * @param variables - Effective variables after pre-request scripts have run.
 * @param deps - Host dependencies, including optional OAuth token retrieval.
 * @returns Fully resolved HTTP request payload ready for transport.
 */
export async function buildSendInput(
  input: RunRequestInput,
  request: ScriptRequestContext,
  variables: Record<string, string>,
  deps: Pick<RequestRunnerDeps, 'fetchOAuthToken'>
): Promise<SendRequestInput> {
  const collectionHeaders = resolveHeaderValues(input.collection?.headers ?? [], variables);
  const folderHeaders = resolveHeaderValues(input.folder?.headers ?? [], variables);
  const requestHeaders = resolveHeaderValues(request.headers, variables);
  const allHeaders = [...collectionHeaders, ...folderHeaders, ...requestHeaders];
  const effectiveAuth = resolveEffectiveAuth(
    request.auth,
    input.folder?.auth,
    input.collection?.auth
  );
  const resolvedAuth = resolveAuthVariables(effectiveAuth, (text) =>
    substituteRequestVariables(text, variables)
  );
  const manualAuthorization = hasManualAuthorizationHeader(allHeaders);
  const authHeader = await resolveAuthorizationHeader(
    input,
    request,
    resolvedAuth,
    manualAuthorization,
    deps.fetchOAuthToken
  );
  const headers =
    authHeader && !manualAuthorization
      ? [{ key: 'Authorization', value: authHeader, enabled: true }, ...allHeaders]
      : allHeaders;
  const sourceRequestId = input.requestIdentity?.id;
  const sourceRequestName = input.requestIdentity?.name?.trim();
  const bodyRaw = input.requestIdentity?.bodyRaw;
  const sendInput: SendRequestInput = {
    method: request.method,
    url: substituteRequestVariables(request.url, variables),
    headers,
    params: resolveHeaderValues(request.params, variables),
    body: substituteRequestVariables(request.body, variables),
    bodyType: request.bodyType,
    ...(sourceRequestId != null ? { sourceRequestId } : {}),
    ...(sourceRequestName ? { sourceRequestName } : {})
  };

  return applyBodyRawOverride(
    sendInput,
    bodyRaw == null ? null : substituteRequestVariables(bodyRaw, variables),
    request.bodyType
  );
}

/**
 * Resolves variables in editable header or query-parameter rows.
 *
 * @param rows - Raw editable rows from one request scope.
 * @param variables - Effective variables for the current execution.
 * @returns Independent rows with resolved values.
 */
function resolveHeaderValues(rows: KeyValue[], variables: Record<string, string>): KeyValue[] {
  return rows.map((row) => ({
    ...row,
    value: substituteRequestVariables(row.value, variables)
  }));
}

/**
 * Builds generated authentication, fetching OAuth tokens only when necessary.
 *
 * @param input - Request identity and inheritance context.
 * @param request - Script-mutated request context.
 * @param auth - Variable-resolved effective auth configuration.
 * @param manualAuthorization - Whether explicit headers suppress generated auth.
 * @param fetchOAuthToken - Optional host OAuth implementation.
 * @returns Authorization header value or null when auth is inactive.
 * @throws Error when OAuth is configured but no token fetcher is available.
 */
async function resolveAuthorizationHeader(
  input: RunRequestInput,
  request: ScriptRequestContext,
  auth: AuthConfig,
  manualAuthorization: boolean,
  fetchOAuthToken: RequestRunnerDeps['fetchOAuthToken']
): Promise<string | null> {
  const directHeader = buildAuthHeaderValue(auth);
  if (directHeader || auth.type !== 'oauth2' || manualAuthorization) {
    return directHeader;
  }
  if (!fetchOAuthToken) {
    throw new Error('OAuth authentication requires a fetchOAuthToken dependency.');
  }

  const cacheKey = input.oauthCacheKey ?? resolveOAuthCacheKey(input, request);
  const token = await fetchOAuthToken(cacheKey, auth.oauth2);
  const header = buildOAuthAuthHeaderValue(token);
  if (!header) {
    throw new Error('OAuth token response contained an invalid access token.');
  }
  return header;
}

/**
 * Maps the winning auth scope to the cache namespace used by existing hosts.
 *
 * @param input - Request context used to determine inherited auth ownership.
 * @param request - Request after pre-script auth mutations.
 * @returns Stable OAuth cache key, or an empty key for unsaved entities.
 */
function resolveOAuthCacheKey(input: RunRequestInput, request: ScriptRequestContext): string {
  if (request.auth?.type === 'oauth2' && input.requestIdentity?.id != null) {
    return buildOAuthCacheKey('request', input.requestIdentity.id);
  }
  if (
    request.auth?.type === 'none' &&
    input.folder?.auth?.type === 'oauth2' &&
    input.folder.id != null
  ) {
    return buildOAuthCacheKey('folder', input.folder.id);
  }
  return input.collection?.id != null ? buildOAuthCacheKey('collection', input.collection.id) : '';
}
