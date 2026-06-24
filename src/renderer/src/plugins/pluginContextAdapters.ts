import type { RequestDraft as StoreRequestDraft } from '#/renderer/src/store/drafts';
import type { SendResult } from '#/shared/types';
import type { HttpResponse, RequestDraft } from '#/shared/plugin/types';

/**
 * Maps the store request draft to the plugin-facing read-only shape.
 *
 * @param draft - Active request draft from Redux.
 */
export function toPluginRequestDraft(draft: StoreRequestDraft): RequestDraft {
  return {
    method: draft.method,
    url: draft.url,
    params: draft.params.map((row) => ({ ...row })),
    headers: draft.headers.map((row) => ({ ...row })),
    body: draft.body
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
