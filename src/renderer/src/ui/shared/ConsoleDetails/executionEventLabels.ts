import type { ScriptExecutionEvent } from '#/shared/types';

const SCOPE_LABELS: Record<'request' | 'collection' | 'environment' | 'global', string> = {
  request: 'Request',
  collection: 'Collection',
  environment: 'Environment',
  global: 'Global'
};

/**
 * Returns a short action label for a variable execution event.
 *
 * @param event - Variable mutation captured during script execution.
 * @returns Human-readable action text for the console inspector.
 */
export function formatVariableExecutionLabel(
  event: Extract<ScriptExecutionEvent, { type: 'variable' }>
): string {
  const scopeLabel = SCOPE_LABELS[event.scope];
  switch (event.action) {
    case 'set':
      return `Set ${scopeLabel} variable`;
    case 'update':
      return `Update ${scopeLabel} variable`;
    case 'clear':
      return `Clear ${scopeLabel} variable`;
  }
}

/**
 * Returns a short action label for a flow-control execution event.
 *
 * @param event - Flow directive captured during script execution.
 * @returns Human-readable action text for the console inspector.
 */
export function formatFlowExecutionLabel(
  event: Extract<ScriptExecutionEvent, { type: 'flow' }>
): string {
  switch (event.action) {
    case 'set-next-request':
      return event.nextRequest == null ? 'Stop collection run' : 'Set next request';
    case 'skip-request':
      return 'Skip request';
  }
}

/**
 * Returns detail text shown beside a variable execution event label.
 *
 * @param event - Variable mutation captured during script execution.
 * @returns Key/value detail for set and update events, or the cleared key.
 */
export function formatVariableExecutionDetail(
  event: Extract<ScriptExecutionEvent, { type: 'variable' }>
): string {
  if (event.action === 'clear') {
    return event.key;
  }
  return `${event.key} = ${event.value ?? ''}`;
}

/**
 * Returns detail text shown beside a flow-control execution event label.
 *
 * @param event - Flow directive captured during script execution.
 * @returns Target request name when applicable.
 */
export function formatFlowExecutionDetail(
  event: Extract<ScriptExecutionEvent, { type: 'flow' }>
): string | undefined {
  if (event.action === 'set-next-request' && event.nextRequest != null) {
    return event.nextRequest;
  }
  return undefined;
}
