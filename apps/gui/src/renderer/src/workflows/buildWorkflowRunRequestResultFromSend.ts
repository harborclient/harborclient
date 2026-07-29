import type { WorkflowRunRequestResult } from '@harborclient/core/types';
import { buildWorkflowRunRequestResult } from '@harborclient/core/types';
import type { RequestDraft } from '#/renderer/src/store/tabs';
import type { RequestRunOutcome } from '#/renderer/src/store/thunks/requests';
import type { RootState } from '#/renderer/src/store/redux';
import { findSavedRequestById } from './workflowPlaybackHelpers';

/**
 * Builds a workflow-run request result entry from a completed send.
 *
 * Prefers the actually-sent request metadata on the response when present,
 * falling back to the active draft for name, auth, notes, and body.
 * For binary responses, stores `bodyBase64` in `response.body` (portable schema
 * is a string only) so run exports keep lossless bytes.
 *
 * @param draft - Request draft that was sent.
 * @param outcome - Completed send outcome including tests and `hc.data`.
 * @param state - Redux state used to resolve the saved-request uuid.
 * @returns Portable request+response result for the run log.
 */
export function buildWorkflowRunRequestResultFromSend(
  draft: RequestDraft,
  outcome: RequestRunOutcome,
  state: RootState
): WorkflowRunRequestResult {
  const saved = draft.id != null ? findSavedRequestById(state, draft.id) : undefined;
  const sent = outcome.response.request;
  const responseBody =
    outcome.response.bodyBase64 != null && outcome.response.bodyBase64.length > 0
      ? outcome.response.bodyBase64
      : outcome.response.body;

  return buildWorkflowRunRequestResult({
    name: draft.name,
    uuid: saved?.uuid ?? '',
    method: sent?.method ?? draft.method,
    url: sent?.url ?? draft.url,
    headers: sent
      ? Object.entries(sent.headers).map(([key, value]) => ({
          key,
          value,
          enabled: true
        }))
      : draft.headers.map((row) => ({ ...row })),
    cookies: outcome.cookies.map((row) => ({ ...row })),
    tags: draft.tags,
    comment: draft.comment,
    body: sent?.body ?? draft.body,
    authorization: draft.auth,
    responseBody,
    status: outcome.response.status,
    statusText: outcome.response.statusText,
    responseHeaders: outcome.response.headers,
    timeMs: outcome.response.timeMs,
    sizeBytes: outcome.response.sizeBytes,
    timing: outcome.response.timing,
    tests: outcome.testResults,
    data: outcome.data,
    scriptLogs: outcome.scriptLogs,
    executionEvents: outcome.executionEvents,
    scriptError: outcome.scriptError,
    scriptErrors: outcome.scriptErrors
  });
}
