import type { RequestDraft as StoreRequestDraft } from '#/renderer/src/store/tabs';
import type { Collection, SendResult } from '@harborclient/core/types';
import { defaultAuth, normalizeAuth } from '@harborclient/core/auth';
import type {
  HttpResponse,
  RequestDraft,
  RequestTabContext
} from '@harborclient/core/plugin/types';

/**
 * Maps the store request draft to the plugin-facing read-only shape.
 *
 * @param draft - Active request draft from Redux.
 */
export function toPluginRequestDraft(draft: StoreRequestDraft): RequestDraft {
  return {
    method: draft.method,
    protocol: draft.protocol === 'sse' ? 'sse' : 'http',
    url: draft.url,
    params: draft.params.map((row) => ({ ...row })),
    headers: draft.headers.map((row) => ({ ...row })),
    body: draft.body,
    auth: normalizeAuth(draft.auth),
    body_type: draft.body_type
  };
}

/**
 * Builds a stable per-request key for plugin state namespacing.
 *
 * Saved requests use `req:<id>` so the key survives edits and restarts. Unsaved
 * tabs fall back to a best-effort `METHOD url` fingerprint.
 *
 * @param draft - Active request draft from Redux.
 * @returns Stable request key for plugin storage.
 */
export function pluginRequestKey(draft: StoreRequestDraft): string {
  if (draft.id != null) {
    return `req:${draft.id}`;
  }
  return `${draft.method.trim().toUpperCase()} ${draft.url.trim()}`;
}

/**
 * Builds the read-only context passed to request editor plugin tabs.
 *
 * @param draft - Active request draft from Redux.
 * @param collection - Collection owning the request, when known.
 * @param response - Last send result for the tab, if any.
 */
export function toPluginRequestTabContext(
  draft: StoreRequestDraft,
  collection: Collection | undefined,
  response: SendResult | null,
  runtimeVars: Record<string, string>
): RequestTabContext {
  return {
    draft: toPluginRequestDraft(draft),
    response: toPluginHttpResponse(response),
    readOnly: true,
    collectionAuth: normalizeAuth(collection?.auth ?? defaultAuth()),
    collectionHeaders: (collection?.headers ?? []).map((row) => ({ ...row })),
    variables: runtimeVars,
    requestKey: pluginRequestKey(draft)
  };
}

/**
 * Maps a send result to the plugin-facing HTTP response shape.
 *
 * @param response - Completed send result, if any.
 */
export function toPluginHttpResponse(response: SendResult | null): HttpResponse | null {
  if (!response || response.error) {
    return null;
  }
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.entries(response.headers).map(([key, value]) => ({
      key,
      value,
      enabled: true
    })),
    body: response.body,
    durationMs: response.timeMs,
    sizeBytes: response.sizeBytes
  };
}

/**
 * Returns true when a tab id refers to a plugin contribution rather than a built-in tab.
 *
 * @param tabId - Segmented tab value.
 */
export function isPluginTabId(tabId: string): boolean {
  return tabId.startsWith('plugin:');
}
