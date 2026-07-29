import type { WorkflowRunRequestResult } from '@harborclient/core/types';

/**
 * Returns whether a run-log result is a portable request+response send snapshot.
 *
 * @param value - Unknown run-log result entry.
 * @returns True when the value has request result fields used for display.
 */
export function isWorkflowRunRequestResult(value: unknown): value is WorkflowRunRequestResult {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === 'string' &&
    typeof record.method === 'string' &&
    record.response != null &&
    typeof record.response === 'object'
  );
}
