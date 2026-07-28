import type { WorkflowAction } from '@harborclient/core/types/workflow';
import type { WorkflowEvent } from './workflowEventTypes';

/**
 * Returns whether a key/value row has a non-empty key or value.
 *
 * @param row - Unknown header/param candidate.
 * @returns True when the row should be kept in an export.
 */
function isNonEmptyKeyValue(row: unknown): boolean {
  if (typeof row !== 'object' || row == null) {
    return false;
  }
  const entry = row as { key?: unknown; value?: unknown };
  const key = typeof entry.key === 'string' ? entry.key.trim() : '';
  const value = typeof entry.value === 'string' ? entry.value.trim() : '';
  return key.length > 0 || value.length > 0;
}

/**
 * Strips empty editor placeholder rows from a draft-like payload.
 *
 * @param payload - Action payload to sanitize.
 * @returns Sanitized payload copy when draft fields are present.
 */
function sanitizeDraftPayload(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload == null) {
    return payload;
  }

  const draft = payload as {
    headers?: unknown;
    params?: unknown;
  };
  const next = { ...draft };
  if (Array.isArray(draft.headers)) {
    next.headers = draft.headers.filter(isNonEmptyKeyValue);
  }
  if (Array.isArray(draft.params)) {
    next.params = draft.params.filter(isNonEmptyKeyValue);
  }
  return next;
}

/**
 * Returns a non-empty action uuid from an existing action, or mints a new one.
 *
 * @param action - Event or action that may already carry a uuid.
 * @returns Stable action uuid string.
 */
function resolveActionUuid(action: { uuid?: string }): string {
  const existing = typeof action.uuid === 'string' ? action.uuid.trim() : '';
  return existing.length > 0 ? existing : crypto.randomUUID();
}

/**
 * Normalizes recorder events or stored actions for portable export.
 *
 * Preserves each action's uuid when present; mints one for legacy actions that
 * lack it so exports and persistence always include per-action identifiers.
 *
 * @param actions - Session events or persisted actions.
 * @returns Sanitized workflow actions.
 */
export function sanitizeWorkflowActions(
  actions: readonly WorkflowEvent[] | readonly WorkflowAction[]
): WorkflowAction[] {
  return actions.map((action) => ({
    uuid: resolveActionUuid(action),
    type: action.type,
    ...(typeof action.at === 'number' ? { at: action.at } : {}),
    payload: action.type === 'request.draft' ? sanitizeDraftPayload(action.payload) : action.payload
  }));
}
