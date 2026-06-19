import type { Completion, CompletionContext, CompletionSource } from '@codemirror/autocomplete';
import type { ScriptPhase, Variable } from '#/shared/types';

/**
 * Hand-maintained completion surface for the hc sandbox API.
 * Keep in sync with the bootstrap in src/main/scripts.ts.
 */
interface HcCompletionOption {
  label: string;
  type: string;
  detail?: string;
}

const TOP_LEVEL: HcCompletionOption[] = [
  { label: 'hc', type: 'namespace', detail: 'HarborClient script API' },
  { label: 'console', type: 'namespace', detail: 'Script console output' }
];

const HC_ROOT: HcCompletionOption[] = [
  { label: 'request', type: 'property', detail: 'Read/write outgoing request' },
  { label: 'variables', type: 'property', detail: 'Get/set ephemeral variables' },
  { label: 'test', type: 'function', detail: '(name, fn) => void' },
  { label: 'expect', type: 'function', detail: '(actual) => Expect' },
  { label: 'response', type: 'property', detail: 'Post-request response (post scripts only)' }
];

const HC_REQUEST: HcCompletionOption[] = [
  { label: 'method', type: 'property', detail: 'HTTP method string' },
  { label: 'url', type: 'property', detail: 'Request URL string' },
  { label: 'body', type: 'property', detail: 'Request body string' },
  { label: 'headers', type: 'property', detail: 'Request headers API' }
];

const HC_REQUEST_HEADERS: HcCompletionOption[] = [
  { label: 'get', type: 'method', detail: '(key) => string | undefined' },
  { label: 'upsert', type: 'method', detail: '(key, value) => void' },
  { label: 'toObject', type: 'method', detail: '() => Record<string, string>' }
];

const HC_VARIABLES: HcCompletionOption[] = [
  { label: 'get', type: 'method', detail: '(key) => string | undefined' },
  { label: 'set', type: 'method', detail: '(key, value) => void' }
];

const HC_RESPONSE: HcCompletionOption[] = [
  { label: 'code', type: 'property', detail: 'HTTP status code' },
  { label: 'status', type: 'property', detail: 'HTTP status text' },
  { label: 'headers', type: 'property', detail: 'Response headers map' },
  { label: 'responseTime', type: 'property', detail: 'Round-trip time in ms' },
  { label: 'text', type: 'method', detail: '() => response body string' },
  { label: 'json', type: 'method', detail: '() => parsed JSON body' }
];

const CONSOLE: HcCompletionOption[] = [
  { label: 'log', type: 'method', detail: '(...args) => void' },
  { label: 'error', type: 'method', detail: '(...args) => void' }
];

const GROUPS: Record<string, HcCompletionOption[]> = {
  '': TOP_LEVEL,
  hc: HC_ROOT,
  'hc.request': HC_REQUEST,
  'hc.request.headers': HC_REQUEST_HEADERS,
  'hc.variables': HC_VARIABLES,
  'hc.response': HC_RESPONSE,
  console: CONSOLE
};

/**
 * Returns completion options for a dotted path prefix, filtered by script phase.
 *
 * @param prefix - Path before the final segment (e.g. "hc.request.headers").
 * @param phase - Pre or post script; response API is post-only.
 */
function optionsForPrefix(prefix: string, phase: ScriptPhase): HcCompletionOption[] {
  const options = GROUPS[prefix];
  if (!options) return [];

  if (phase === 'pre' && prefix === 'hc') {
    return options.filter((option) => option.label !== 'response');
  }

  if (phase === 'pre' && prefix.startsWith('hc.response')) {
    return [];
  }

  return options;
}

/**
 * Filters options by a partial label match.
 *
 * @param options - Candidate completion options.
 * @param partial - Text typed after the last dot.
 */
function filterByPartial(options: HcCompletionOption[], partial: string): HcCompletionOption[] {
  if (!partial) return options;
  const lower = partial.toLowerCase();
  return options.filter((option) => option.label.toLowerCase().startsWith(lower));
}

/**
 * Builds variable completions inside {{ }} placeholders.
 *
 * @param context - CodeMirror completion context.
 * @param variables - Collection-scoped variables.
 */
function variableCompletions(
  context: CompletionContext,
  variables: Variable[]
): { from: number; options: Completion[] } | null {
  const match = context.matchBefore(/\{\{\s*[\w.-]*$/);
  if (!match) return null;

  const braceIndex = match.text.indexOf('{{');
  if (braceIndex === -1) return null;

  const inner = match.text.slice(braceIndex + 2);
  const partial = inner.trimStart().toLowerCase();
  const from = match.from + braceIndex + 2 + (inner.length - inner.trimStart().length);

  const options: Completion[] = variables
    .filter((variable) => variable.key.trim())
    .filter((variable) => !partial || variable.key.trim().toLowerCase().startsWith(partial))
    .map((variable) => ({
      label: variable.key.trim(),
      type: 'variable',
      apply: variable.key.trim()
    }));

  if (options.length === 0) return null;
  return { from, options };
}

/**
 * Builds dotted-path completions for hc and console APIs.
 *
 * @param context - CodeMirror completion context.
 * @param phase - Pre or post script phase.
 */
function dottedPathCompletions(
  context: CompletionContext,
  phase: ScriptPhase
): { from: number; options: Completion[] } | null {
  const word = context.matchBefore(/[\w.]*/);
  if (!word || word.text.length === 0) return null;

  const lastDot = word.text.lastIndexOf('.');
  const prefix = lastDot === -1 ? '' : word.text.slice(0, lastDot);
  const partial = lastDot === -1 ? word.text : word.text.slice(lastDot + 1);

  const candidates = optionsForPrefix(prefix, phase);
  const filtered = filterByPartial(candidates, partial);
  if (filtered.length === 0) return null;

  const from = word.from + (lastDot === -1 ? 0 : lastDot + 1);
  return {
    from,
    options: filtered.map((option) => ({
      label: option.label,
      type: option.type,
      detail: option.detail
    }))
  };
}

/**
 * Creates a CodeMirror completion source for HarborClient pre/post scripts.
 *
 * @param phase - Whether the editor is for a pre- or post-request script.
 * @param variables - Collection variables for {{key}} completion.
 * @returns Completion source; returns null when no HarborClient-specific match applies.
 */
export function createHcCompletionSource(
  phase: ScriptPhase,
  variables: Variable[]
): CompletionSource {
  return (context) => {
    const variableMatch = variableCompletions(context, variables);
    if (variableMatch) return variableMatch;

    return dottedPathCompletions(context, phase);
  };
}
