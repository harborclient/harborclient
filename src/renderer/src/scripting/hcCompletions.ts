import type { Completion, CompletionContext, CompletionSource } from '@codemirror/autocomplete';
import type { ScriptPhase, Variable } from '#/shared/types';
import {
  DYNAMIC_VARIABLE_NAMES,
  getDynamicVariableDescription,
  VARIABLE_NAME_CHARS
} from '@harborclient/sdk/variables';

/**
 * Hand-maintained completion surface for the hc sandbox API.
 * Keep in sync with the bootstrap in src/main/scripting/scriptEvaluator.ts.
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
  { label: 'info', type: 'property', detail: 'Script run metadata (read-only)' },
  { label: 'request', type: 'property', detail: 'Read/write outgoing request' },
  { label: 'collection', type: 'property', detail: 'Collection metadata, variables, and headers' },
  { label: 'environment', type: 'property', detail: 'Environment metadata and variables' },
  { label: 'globals', type: 'property', detail: 'Get/set/clear app-wide global variables' },
  { label: 'cookies', type: 'property', detail: 'Get/set/clear cookies for the request host' },
  {
    label: 'data',
    type: 'property',
    detail: 'Mutable object shared across scripts in this send (pre → post)'
  },
  { label: 'execution', type: 'property', detail: 'Collection runner flow control' },
  {
    label: 'sendRequest',
    type: 'function',
    detail: '(req) => Promise<Response> — requires Settings → General'
  },
  { label: 'test', type: 'function', detail: '(name, fn) => void' },
  { label: 'expect', type: 'function', detail: '(actual) => Chai BDD assertion' },
  { label: 'response', type: 'property', detail: 'Post-request response (post scripts only)' }
];

const HC_REQUEST: HcCompletionOption[] = [
  { label: 'method', type: 'property', detail: 'HTTP method string' },
  { label: 'url', type: 'property', detail: 'Request URL string' },
  { label: 'body', type: 'property', detail: 'Request body string' },
  { label: 'headers', type: 'property', detail: 'Request headers API' },
  { label: 'params', type: 'property', detail: 'Request query params API' },
  { label: 'notes', type: 'property', detail: 'Request tags & comment API' },
  { label: 'auth', type: 'property', detail: 'Request auth API' },
  { label: 'variables', type: 'property', detail: 'Get/set ephemeral variables' }
];

const HC_PARAMETER_BAG: HcCompletionOption[] = [
  {
    label: 'get',
    type: 'method',
    detail: '() => Record<string, string> | (key) => string | undefined'
  },
  { label: 'set', type: 'method', detail: '(entries) => void | (key, value) => void' },
  { label: 'clear', type: 'method', detail: '() => void' }
];

const HC_NOTES_BAG: HcCompletionOption[] = [
  { label: 'get', type: 'method', detail: '() => { tags, comment } | (field) => string' },
  { label: 'set', type: 'method', detail: '(entries) => void | (field, value) => void' },
  { label: 'clear', type: 'method', detail: '() => void' }
];

const HC_VARIABLE_BAG: HcCompletionOption[] = [
  { label: 'get', type: 'method', detail: '(key) => string | undefined' },
  { label: 'set', type: 'method', detail: '(key, value) => void' },
  { label: 'clear', type: 'method', detail: '(key) => void' }
];

const HC_VARIABLES: HcCompletionOption[] = [
  ...HC_VARIABLE_BAG,
  {
    label: 'replaceIn',
    type: 'method',
    detail: '(template) => string — resolve {{vars}} and dynamic $ tokens'
  }
];

const HC_COOKIES: HcCompletionOption[] = [
  { label: 'get', type: 'method', detail: '(name) => string | undefined' },
  { label: 'set', type: 'method', detail: '(name, value) => void' },
  { label: 'clear', type: 'method', detail: '(name) => void' }
];

const HC_EXECUTION: HcCompletionOption[] = [
  { label: 'setNextRequest', type: 'method', detail: '(name | null) => void' },
  { label: 'skipRequest', type: 'method', detail: '() => void' }
];

const HC_INFO: HcCompletionOption[] = [
  { label: 'eventName', type: 'property', detail: '"prerequest" | "test"' },
  { label: 'requestName', type: 'property', detail: 'Saved request display name' },
  { label: 'requestId', type: 'property', detail: 'Saved request id string, or empty' },
  {
    label: 'iteration',
    type: 'property',
    detail: 'Collection run iteration (0 when not data-driven)'
  }
];

const HC_COLLECTION: HcCompletionOption[] = [
  { label: 'id', type: 'property', detail: 'Collection database id (read-only)' },
  { label: 'name', type: 'property', detail: 'Collection display name (read-only)' },
  { label: 'variables', type: 'property', detail: 'Get/set collection variables' },
  { label: 'headers', type: 'property', detail: 'Collection headers API' },
  { label: 'auth', type: 'property', detail: 'Collection auth API' }
];

const HC_ENVIRONMENT: HcCompletionOption[] = [
  { label: 'name', type: 'property', detail: 'Environment display name (read-only)' },
  { label: 'variables', type: 'property', detail: 'Get/set environment variables' }
];

const HC_AUTH: HcCompletionOption[] = [
  { label: 'get', type: 'method', detail: '() => { type, token?, username?, ... }' },
  { label: 'set', type: 'method', detail: '(auth) => void — flat auth object' },
  { label: 'update', type: 'method', detail: "(field, value) => void — e.g. 'type', 'token'" }
];

const HC_RESPONSE: HcCompletionOption[] = [
  { label: 'code', type: 'property', detail: 'HTTP status code' },
  { label: 'status', type: 'property', detail: 'HTTP status text' },
  { label: 'headers', type: 'property', detail: 'Response headers map' },
  { label: 'responseTime', type: 'property', detail: 'Round-trip time in ms' },
  { label: 'to', type: 'property', detail: 'Chai response assertions (post only)' },
  { label: 'text', type: 'method', detail: '() => response body string' },
  { label: 'json', type: 'method', detail: '() => parsed JSON body' },
  {
    label: 'document',
    type: 'method',
    detail: '() => { querySelector, querySelectorAll } — HTML body (Cheerio)'
  }
];

/**
 * Common Chai BDD language chains, matchers, and assertion properties for hc.expect chains.
 */
const CHAI_COMMON: HcCompletionOption[] = [
  { label: 'to', type: 'property', detail: 'Chai language chain' },
  { label: 'be', type: 'property', detail: 'Chai language chain' },
  { label: 'been', type: 'property', detail: 'Chai language chain' },
  { label: 'is', type: 'property', detail: 'Chai language chain' },
  { label: 'that', type: 'property', detail: 'Chai language chain' },
  { label: 'which', type: 'property', detail: 'Chai language chain' },
  { label: 'and', type: 'property', detail: 'Chai language chain' },
  { label: 'has', type: 'property', detail: 'Chai language chain' },
  { label: 'have', type: 'property', detail: 'Chai language chain' },
  { label: 'with', type: 'property', detail: 'Chai language chain' },
  { label: 'of', type: 'property', detail: 'Chai language chain' },
  { label: 'not', type: 'property', detail: 'Negated assertion' },
  { label: 'deep', type: 'property', detail: 'Deep equality modifier' },
  { label: 'nested', type: 'property', detail: 'Nested include modifier' },
  { label: 'own', type: 'property', detail: 'Own property modifier' },
  { label: 'ordered', type: 'property', detail: 'Ordered members modifier' },
  { label: 'any', type: 'property', detail: 'Any keys modifier' },
  { label: 'all', type: 'property', detail: 'All keys modifier' },
  { label: 'equal', type: 'method', detail: '(expected) => void — strict equality' },
  { label: 'eql', type: 'method', detail: '(expected) => void — deep equality' },
  { label: 'include', type: 'method', detail: '(value) => void — string/array/object contains' },
  { label: 'contain', type: 'method', detail: '(value) => void — alias for include' },
  { label: 'a', type: 'method', detail: '(type) => void — typeof check' },
  { label: 'an', type: 'method', detail: '(type) => void — typeof check' },
  { label: 'above', type: 'method', detail: '(n) => void — greater than' },
  { label: 'below', type: 'method', detail: '(n) => void — less than' },
  { label: 'least', type: 'method', detail: '(n) => void — greater than or equal' },
  { label: 'most', type: 'method', detail: '(n) => void — less than or equal' },
  { label: 'within', type: 'method', detail: '(start, end) => void — in range' },
  { label: 'instanceOf', type: 'method', detail: '(ctor) => void — instanceof check' },
  { label: 'property', type: 'method', detail: '(name, value?) => void — object property' },
  { label: 'ownProperty', type: 'method', detail: '(name, value?) => void — own property' },
  { label: 'lengthOf', type: 'method', detail: '(n) => void — collection length' },
  { label: 'match', type: 'method', detail: '(regex) => void — string regex match' },
  { label: 'string', type: 'method', detail: '(str) => void — string contains' },
  { label: 'keys', type: 'method', detail: '(keys) => void — object keys' },
  { label: 'members', type: 'method', detail: '(members) => void — object members' },
  { label: 'oneOf', type: 'method', detail: '(list) => void — value in list' },
  { label: 'throw', type: 'method', detail: '(type?) => void — function throws' },
  { label: 'closeTo', type: 'method', detail: '(expected, delta) => void — approximate number' },
  { label: 'satisfy', type: 'method', detail: '(fn) => void — custom predicate' },
  { label: 'ok', type: 'property', detail: 'Truthy (or 2xx on hc.response.to)' },
  { label: 'true', type: 'property', detail: 'Strict true' },
  { label: 'false', type: 'property', detail: 'Strict false' },
  { label: 'null', type: 'property', detail: 'Strict null' },
  { label: 'undefined', type: 'property', detail: 'Undefined' },
  { label: 'NaN', type: 'property', detail: 'Not a Number' },
  { label: 'exist', type: 'property', detail: 'Value is not null or undefined' },
  { label: 'empty', type: 'property', detail: 'Length zero or empty object' },
  { label: 'finite', type: 'property', detail: 'Number is finite' }
];

/**
 * Postman-style response matchers registered on hc.response.to (Phase B plugin).
 */
const RESPONSE_MATCHERS: HcCompletionOption[] = [
  { label: 'status', type: 'method', detail: '(code | statusText) => void' },
  { label: 'header', type: 'method', detail: '(name, value?) => void' },
  { label: 'body', type: 'method', detail: '(expected?) => void' },
  { label: 'jsonBody', type: 'method', detail: '(expected?) => void' },
  { label: 'json', type: 'property', detail: 'JSON content-type and valid body' },
  { label: 'withBody', type: 'property', detail: 'Non-empty response body' },
  { label: 'success', type: 'property', detail: '2xx status' },
  { label: 'redirection', type: 'property', detail: '3xx status' },
  { label: 'clientError', type: 'property', detail: '4xx status' },
  { label: 'serverError', type: 'property', detail: '5xx status' },
  { label: 'error', type: 'property', detail: '4xx or 5xx status' },
  { label: 'accepted', type: 'property', detail: '202 status' },
  { label: 'badRequest', type: 'property', detail: '400 status' },
  { label: 'unauthorized', type: 'property', detail: '401 status' },
  { label: 'forbidden', type: 'property', detail: '403 status' },
  { label: 'notFound', type: 'property', detail: '404 status' },
  { label: 'rateLimited', type: 'property', detail: '429 status' }
];

/**
 * First-level hc.response.to chain starters (Postman-style entry points).
 */
const RESPONSE_CHAIN_ROOT: HcCompletionOption[] = [
  { label: 'have', type: 'property', detail: 'Response have matchers' },
  { label: 'be', type: 'property', detail: 'Response be matchers' },
  { label: 'not', type: 'property', detail: 'Negated assertion' },
  { label: 'status', type: 'method', detail: '(code | statusText) => void' }
];

/** Dotted-path fallback for hc.response.to (post scripts). */
const HC_RESPONSE_TO: HcCompletionOption[] = [
  { label: 'have', type: 'property', detail: 'Response have matchers' },
  { label: 'be', type: 'property', detail: 'Response be matchers' },
  { label: 'not', type: 'property', detail: 'Negated assertion' }
];

/** Dotted-path fallback for hc.response.to.have (post scripts). */
const HC_RESPONSE_TO_HAVE: HcCompletionOption[] = [
  { label: 'status', type: 'method', detail: '(code | statusText) => void' },
  { label: 'header', type: 'method', detail: '(name, value?) => void' },
  { label: 'body', type: 'method', detail: '(expected?) => void' },
  { label: 'jsonBody', type: 'method', detail: '(expected?) => void' }
];

/** Dotted-path fallback for hc.response.to.be (post scripts). */
const HC_RESPONSE_TO_BE: HcCompletionOption[] = [
  { label: 'json', type: 'property', detail: 'JSON content-type and valid body' },
  { label: 'ok', type: 'property', detail: '2xx status' },
  { label: 'withBody', type: 'property', detail: 'Non-empty response body' },
  { label: 'success', type: 'property', detail: '2xx status' },
  { label: 'clientError', type: 'property', detail: '4xx status' },
  { label: 'notFound', type: 'property', detail: '404 status' },
  { label: 'unauthorized', type: 'property', detail: '401 status' },
  { label: 'error', type: 'property', detail: '4xx or 5xx status' }
];

const CONSOLE: HcCompletionOption[] = [
  { label: 'log', type: 'method', detail: '(...args) => void' },
  { label: 'error', type: 'method', detail: '(...args) => void' }
];

const GROUPS: Record<string, HcCompletionOption[]> = {
  '': TOP_LEVEL,
  hc: HC_ROOT,
  'hc.request': HC_REQUEST,
  'hc.request.headers': HC_PARAMETER_BAG,
  'hc.request.params': HC_PARAMETER_BAG,
  'hc.request.notes': HC_NOTES_BAG,
  'hc.request.auth': HC_AUTH,
  'hc.request.variables': HC_VARIABLES,
  'hc.collection': HC_COLLECTION,
  'hc.collection.variables': HC_VARIABLE_BAG,
  'hc.collection.headers': HC_PARAMETER_BAG,
  'hc.collection.auth': HC_AUTH,
  'hc.environment': HC_ENVIRONMENT,
  'hc.environment.variables': HC_VARIABLE_BAG,
  'hc.globals': HC_VARIABLE_BAG,
  'hc.cookies': HC_COOKIES,
  'hc.execution': HC_EXECUTION,
  'hc.info': HC_INFO,
  'hc.response': HC_RESPONSE,
  'hc.response.to': HC_RESPONSE_TO,
  'hc.response.to.have': HC_RESPONSE_TO_HAVE,
  'hc.response.to.be': HC_RESPONSE_TO_BE,
  console: CONSOLE
};

/**
 * Merges Chai and response matcher options, omitting response labels already in Chai.
 *
 * @param chai - Common Chai completion options.
 * @param response - Response-specific matcher options.
 * @returns Combined list without duplicate labels.
 */
function mergeChaiAndResponse(
  chai: HcCompletionOption[],
  response: HcCompletionOption[]
): HcCompletionOption[] {
  const chaiLabels = new Set(chai.map((option) => option.label));
  const responseOnly = response.filter((option) => !chaiLabels.has(option.label));
  return [...chai, ...responseOnly];
}

/**
 * Maps hand-maintained options to CodeMirror completion entries.
 *
 * @param options - HarborClient completion options.
 * @returns CodeMirror completion objects.
 */
function toCompletions(options: HcCompletionOption[]): Completion[] {
  return options.map((option) => ({
    label: option.label,
    type: option.type,
    detail: option.detail
  }));
}

const CHAI_COMMON_COMPLETIONS = toCompletions(CHAI_COMMON);
const RESPONSE_ROOT_COMPLETIONS = toCompletions(RESPONSE_CHAIN_ROOT);
const MERGED_RESPONSE_CHAIN = mergeChaiAndResponse(CHAI_COMMON, RESPONSE_MATCHERS);
const MERGED_RESPONSE_COMPLETIONS = toCompletions(MERGED_RESPONSE_CHAIN);

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
 * @param options - Candidate completion options or prebuilt completions.
 * @param partial - Text typed after the last dot.
 */
function filterByPartial<T extends { label: string }>(options: T[], partial: string): T[] {
  if (!partial) return options;
  const lower = partial.toLowerCase();
  return options.filter((option) => option.label.toLowerCase().startsWith(lower));
}

/**
 * Finds the index of the opening parenthesis matching a closing `)` at closeIdx.
 *
 * @param text - Source text scanned leftward from closeIdx.
 * @param closeIdx - Index of the closing parenthesis.
 * @returns Index of the matching `(`, or -1 when not found.
 */
function matchingOpenParen(text: string, closeIdx: number): number {
  if (closeIdx < 0 || text[closeIdx] !== ')') {
    return -1;
  }
  let depth = 0;
  for (let index = closeIdx; index >= 0; index -= 1) {
    const char = text[index];
    if (char === ')') {
      depth += 1;
    } else if (char === '(') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

/**
 * Returns true when receiver is a Chai chain rooted at hc.expect(...).
 *
 * @param receiver - Expression before the member-access dot being completed.
 */
function isExpectChain(receiver: string): boolean {
  if (!receiver.includes('expect')) {
    return false;
  }
  const base = receiver.replace(/(\.[\w$]+)*$/, '');
  if (!base.endsWith(')')) {
    return false;
  }
  const closeIdx = base.length - 1;
  const openIdx = matchingOpenParen(base, closeIdx);
  if (openIdx < 0) {
    return false;
  }
  const callee = base.slice(0, openIdx).trimEnd();
  return /hc\s*\.\s*expect$/.test(callee);
}

/**
 * Matches an hc.response.to chain suffix within a longer receiver expression.
 */
const RESPONSE_CHAIN_SUFFIX = /(?:^|\W)\s*(hc\.response\.to(?:\.[\w$]+)*)$/;

/**
 * Extracts the hc.response.to chain suffix from a receiver expression, if present.
 *
 * @param receiver - Expression before the member-access dot being completed.
 * @returns Matched chain suffix (e.g. "hc.response.to.have") or null.
 */
function findResponseChainSuffix(receiver: string): string | null {
  const match = receiver.match(RESPONSE_CHAIN_SUFFIX);
  return match?.[1] ?? null;
}

/**
 * Returns the expression immediately before the member-access dot at the cursor.
 *
 * @param before - Text from the start of the line through the cursor.
 * @returns Receiver expression, or null when the cursor is not after a `.`.
 */
function receiverBeforeCursorDot(before: string): string | null {
  const partialMatch = before.match(/[\w$]*$/);
  if (!partialMatch) {
    return null;
  }
  const partial = partialMatch[0];
  const dotIndex = before.length - partial.length - 1;
  if (dotIndex < 0 || before[dotIndex] !== '.') {
    return null;
  }
  return before.slice(0, dotIndex);
}

/**
 * Returns true when chaiChainCompletions owns completions for this receiver.
 *
 * @param receiver - Expression before the member-access dot being completed.
 */
function isChaiHandledReceiver(receiver: string): boolean {
  return findResponseChainSuffix(receiver) !== null || isExpectChain(receiver);
}

/**
 * Returns prebuilt completions for an hc.response.to chain based on chain depth.
 *
 * @param chainSuffix - Matched suffix such as "hc.response.to" or "hc.response.to.have".
 */
function responseChainCandidates(chainSuffix: string): Completion[] {
  if (chainSuffix === 'hc.response.to') {
    return RESPONSE_ROOT_COMPLETIONS;
  }
  return MERGED_RESPONSE_COMPLETIONS;
}

/**
 * Builds Chai assertion-chain completions for hc.expect(...) and hc.response.to.
 *
 * @param context - CodeMirror completion context.
 * @param phase - Pre or post script phase.
 */
function chaiChainCompletions(
  context: CompletionContext,
  phase: ScriptPhase
): { from: number; options: Completion[]; validFor: RegExp } | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.doc.sliceString(line.from, context.pos);
  const partialMatch = before.match(/[\w$]*$/);
  if (!partialMatch) {
    return null;
  }
  const partial = partialMatch[0];
  const dotIndex = before.length - partial.length - 1;
  if (dotIndex < 0 || before[dotIndex] !== '.') {
    return null;
  }

  const receiver = before.slice(0, dotIndex);
  const from = context.pos - partial.length;

  let candidates: Completion[];
  const responseSuffix = findResponseChainSuffix(receiver);
  if (responseSuffix) {
    if (phase === 'pre') {
      return null;
    }
    candidates = responseChainCandidates(responseSuffix);
  } else if (isExpectChain(receiver)) {
    candidates = CHAI_COMMON_COMPLETIONS;
  } else {
    return null;
  }

  const filtered = filterByPartial(candidates, partial);
  if (filtered.length === 0) {
    return null;
  }

  return { from, options: filtered, validFor: /^[\w$]*$/ };
}

/**
 * Matches an incomplete `{{ variableName` token ending at the cursor.
 */
const VARIABLE_COMPLETION_PATTERN = new RegExp(`\\{\\{\\s*[${VARIABLE_NAME_CHARS}]*$`);

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
  const match = context.matchBefore(VARIABLE_COMPLETION_PATTERN);
  if (!match) return null;

  const braceIndex = match.text.indexOf('{{');
  if (braceIndex === -1) return null;

  const inner = match.text.slice(braceIndex + 2);
  const partial = inner.trimStart().toLowerCase();
  const from = match.from + braceIndex + 2 + (inner.length - inner.trimStart().length);

  const staticOptions: Completion[] = variables
    .filter((variable) => variable.key.trim())
    .filter((variable) => !partial || variable.key.trim().toLowerCase().startsWith(partial))
    .map((variable) => ({
      label: variable.key.trim(),
      type: 'variable',
      apply: variable.key.trim()
    }));

  const dynamicOptions: Completion[] = DYNAMIC_VARIABLE_NAMES.filter(
    (name) => !partial || name.toLowerCase().startsWith(partial)
  ).map((name) => ({
    label: name,
    type: 'variable',
    detail: getDynamicVariableDescription(name),
    apply: name
  }));

  const options = [...staticOptions, ...dynamicOptions];
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
  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.doc.sliceString(line.from, context.pos);
  const receiver = receiverBeforeCursorDot(before);
  if (receiver !== null && isChaiHandledReceiver(receiver)) {
    return null;
  }

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
    options: toCompletions(filtered)
  };
}

/**
 * Matches an incomplete `from './path` or `from "./path` string ending at the cursor.
 */
const IMPORT_FROM_PATTERN = /\bfrom\s*['"]([^'"]*)$/;

/**
 * Matches bare or dynamic `import './path` / `import('./path` strings ending at the cursor.
 */
const IMPORT_BARE_OR_DYNAMIC_PATTERN = /\bimport\s*\(?\s*['"]([^'"]*)$/;

/**
 * Importable snippet filenames, or a getter returning the latest snapshot.
 */
type SnippetNamesSource = string[] | (() => string[]);

/**
 * Resolves importable snippet filenames from a plain array or live getter.
 *
 * @param source - Snippet filenames or a getter returning the latest array.
 * @returns Current importable snippet names for completion.
 */
function resolveSnippetNames(source: SnippetNamesSource): string[] {
  return typeof source === 'function' ? source() : source;
}

/**
 * Extracts the partial import path inside an opening quote when the cursor is in one.
 *
 * @param lineBeforeCursor - Text from the start of the line through the cursor.
 * @returns Partial path inside the quote, or null when not in an import string.
 */
function extractImportPartial(lineBeforeCursor: string): string | null {
  const fromMatch = lineBeforeCursor.match(IMPORT_FROM_PATTERN);
  if (fromMatch) {
    return fromMatch[1];
  }

  const bareMatch = lineBeforeCursor.match(IMPORT_BARE_OR_DYNAMIC_PATTERN);
  if (bareMatch) {
    return bareMatch[1];
  }

  return null;
}

/**
 * Builds directory-style completions for relative snippet import paths.
 *
 * @param context - CodeMirror completion context.
 * @param snippetNames - Importable snippet filenames (for example `utils/foo.js`).
 */
function importPathCompletions(
  context: CompletionContext,
  snippetNames: string[]
): { from: number; options: Completion[] } | null {
  if (snippetNames.length === 0) {
    return null;
  }

  const line = context.state.doc.lineAt(context.pos);
  const lineBeforeCursor = context.state.doc.sliceString(line.from, context.pos);
  const partial = extractImportPartial(lineBeforeCursor);
  if (partial === null || !partial.startsWith('./')) {
    return null;
  }

  const relative = partial.slice(2);
  const lastSlash = relative.lastIndexOf('/');
  const dirPrefix = lastSlash >= 0 ? relative.slice(0, lastSlash + 1) : '';
  const segmentPartial = lastSlash >= 0 ? relative.slice(lastSlash + 1) : relative;
  const segmentLower = segmentPartial.toLowerCase();

  const folderCandidates = new Set<string>();
  const fileCandidates = new Set<string>();

  for (const name of snippetNames) {
    if (!name.startsWith(dirPrefix)) {
      continue;
    }

    const remainder = name.slice(dirPrefix.length);
    if (!remainder) {
      continue;
    }

    const slashIndex = remainder.indexOf('/');
    if (slashIndex >= 0) {
      const folderSegment = remainder.slice(0, slashIndex);
      if (!segmentLower || folderSegment.toLowerCase().startsWith(segmentLower)) {
        folderCandidates.add(`${folderSegment}/`);
      }
      continue;
    }

    if (!segmentLower || remainder.toLowerCase().startsWith(segmentLower)) {
      fileCandidates.add(remainder);
    }
  }

  const options: Completion[] = [
    ...[...folderCandidates].sort().map((folder) => ({
      label: folder,
      type: 'folder',
      detail: 'Snippet folder',
      apply: folder
    })),
    ...[...fileCandidates].sort().map((file) => ({
      label: file,
      type: 'file',
      detail: 'Snippet module',
      apply: file
    }))
  ];

  if (options.length === 0) {
    return null;
  }

  return {
    from: context.pos - segmentPartial.length,
    options
  };
}

/**
 * Collection variables, or a getter returning the latest snapshot for stable closures.
 */
type VariablesSource = Variable[] | (() => Variable[]);

/**
 * Resolves a variables snapshot from a plain array or live getter.
 *
 * @param source - Collection variables or a getter returning the latest array.
 * @returns Current collection variables for completion.
 */
function resolveVariables(source: VariablesSource): Variable[] {
  return typeof source === 'function' ? source() : source;
}

/**
 * Creates a stable completion source that reads phase and variables lazily via getters.
 *
 * Use when parent props churn array identity each render but CodeEditor needs a stable
 * `completionSource` reference. Phase changes invalidate an internal per-phase cache;
 * variables are resolved on each {{ }} completion query.
 *
 * @param getPhase - Returns the current script phase.
 * @param getVariables - Returns the latest collection variables snapshot.
 * @param getSnippetNames - Returns importable snippet filenames for `./` import completion.
 * @returns Stable completion source for CodeEditor.
 */
export function createLiveHcCompletionSource(
  getPhase: () => ScriptPhase,
  getVariables: () => Variable[],
  getSnippetNames: () => string[] = () => []
): CompletionSource {
  let cachedPhase: ScriptPhase | undefined;
  let cachedSource: CompletionSource | undefined;

  /**
   * Returns variable or hc API completions for the current cursor context.
   *
   * @param context - CodeMirror completion context at the cursor.
   */
  return (context) => {
    const phase = getPhase();
    if (cachedPhase !== phase || !cachedSource) {
      cachedPhase = phase;
      cachedSource = createHcCompletionSource(phase, getVariables, getSnippetNames);
    }

    return cachedSource(context);
  };
}

/**
 * Creates a CodeMirror completion source for HarborClient pre/post scripts.
 *
 * @param phase - Whether the editor is for a pre- or post-request script.
 * @param variables - Collection variables for {{key}} completion, or a getter
 *   returning the latest snapshot when array identity churns each render.
 * @param snippetNames - Importable snippet filenames for relative import completion,
 *   or a getter returning the latest snapshot.
 * @returns Completion source; returns null when no HarborClient-specific match applies.
 */
export function createHcCompletionSource(
  phase: ScriptPhase,
  variables: VariablesSource,
  snippetNames: SnippetNamesSource = []
): CompletionSource {
  /**
   * Returns variable, import-path, or hc API completions for the current cursor context.
   *
   * @param context - CodeMirror completion context at the cursor.
   */
  return (context) => {
    const importMatch = importPathCompletions(context, resolveSnippetNames(snippetNames));
    if (importMatch) return importMatch;

    const variableMatch = variableCompletions(context, resolveVariables(variables));
    if (variableMatch) return variableMatch;

    const chaiMatch = chaiChainCompletions(context, phase);
    if (chaiMatch) return chaiMatch;

    return dottedPathCompletions(context, phase);
  };
}
