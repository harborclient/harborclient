import type { ScriptExecutionEvent } from '../types/script';

const SCOPE_LABELS: Record<'request' | 'collection' | 'folder' | 'environment' | 'global', string> =
  {
    request: 'Request',
    collection: 'Collection',
    folder: 'Folder',
    environment: 'Environment',
    global: 'Global'
  };

/**
 * Returns a short action label for a variable execution event.
 *
 * @param event - Variable mutation captured during script execution.
 * @returns Human-readable action text for logs and export.
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
 * @returns Human-readable action text for logs and export.
 */
export function formatFlowExecutionLabel(
  event: Extract<ScriptExecutionEvent, { type: 'flow' }>
): string {
  switch (event.action) {
    case 'set-next-request':
      return event.nextRequest == null ? 'Stop collection run' : 'Set next request';
    case 'skip-request':
      return 'Skip request';
    case 'send-response':
      return 'Send response';
    case 'workflow-next-action':
      return 'Set next workflow action';
    case 'workflow-skip-action':
      return 'Skip workflow action';
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
  if (event.action === 'send-response' && event.status != null) {
    return String(event.status);
  }
  if (event.action === 'workflow-next-action' && event.workflowNextAction != null) {
    return event.workflowNextAction;
  }
  return undefined;
}

/**
 * Builds a single debug-log message for a script execution event.
 *
 * Script source is attached later via log enrichment (`scriptName`), so it is
 * not included here.
 *
 * @param event - Variable or flow-control activity from script execution.
 * @returns Human-readable line for the response Logs tab.
 */
export function formatExecutionEventLogMessage(event: ScriptExecutionEvent): string {
  const label =
    event.type === 'variable'
      ? formatVariableExecutionLabel(event)
      : formatFlowExecutionLabel(event);
  const detail =
    event.type === 'variable'
      ? formatVariableExecutionDetail(event)
      : formatFlowExecutionDetail(event);

  if (detail) {
    return `${label} - ${detail}`;
  }
  return label;
}
