import type { KeyValue } from '../../types/common';
import type { WorkflowRunRequestResult } from '../../types/workflow';
import { buildWorkflowRunRequestResult } from '../../types/workflow';
import type { RunRequestResult } from '../../requestRunner/types';
import type { HeadlessRequestDraft } from './session';

/**
 * Builds a workflow-run request result entry from a headless send.
 *
 * @param draft - Request draft that was sent.
 * @param outcome - Completed {@link runRequest} outcome.
 * @returns Portable request+response result for the run log.
 */
export function buildWorkflowRunRequestResultFromHeadlessSend(
  draft: HeadlessRequestDraft,
  outcome: RunRequestResult
): WorkflowRunRequestResult {
  const sent = outcome.sendInput;
  const responseBody =
    outcome.response.bodyBase64 != null && outcome.response.bodyBase64.length > 0
      ? outcome.response.bodyBase64
      : outcome.response.body;

  const cookies: KeyValue[] = [];

  return buildWorkflowRunRequestResult({
    name: draft.name,
    uuid: draft.uuid ?? '',
    method: sent?.method ?? draft.method,
    url: sent?.url ?? draft.url,
    headers: sent
      ? sent.headers.map((row) => ({ ...row }))
      : draft.headers.map((row) => ({ ...row })),
    cookies,
    tags: draft.tags,
    comment: draft.comment,
    body: sent?.body ?? draft.body,
    authorization: draft.auth,
    responseBody,
    responseHeaders: outcome.response.headers,
    timeMs: outcome.response.timeMs,
    sizeBytes: outcome.response.sizeBytes,
    timing: outcome.response.timing,
    tests: outcome.testResults,
    data: {}
  });
}
