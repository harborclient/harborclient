import jmespath from 'jmespath';
import type { ChatStepMessage, ScriptTestResult, SendResult } from '#/shared/types';

/**
 * Character count for response body previews in summary tools.
 */
export const RESPONSE_BODY_PREVIEW_CHARS = 500;

/**
 * Default maximum response body characters for full-body tool fetches.
 */
export const DEFAULT_RESPONSE_BODY_CHARS = 16384;

/**
 * Per-message content cap applied during aggressive context recovery.
 */
export const AGGRESSIVE_MESSAGE_CONTENT_CHARS = 2000;

/**
 * Maximum history messages kept during aggressive context recovery.
 */
export const AGGRESSIVE_HISTORY_MESSAGE_COUNT = 6;

/**
 * Default maximum characters for stringified JMESPath query results.
 */
export const DEFAULT_QUERY_RESULT_CHARS = 4000;

/**
 * Result of truncating text for LLM consumption.
 */
export interface TruncatedText {
  /**
   * Truncated text safe to send to the model.
   */
  text: string;

  /**
   * Whether the original text was shortened.
   */
  truncated: boolean;

  /**
   * Length of the original string before truncation.
   */
  originalLength: number;
}

/**
 * Options for formatting an HTTP response for agent tools.
 */
export type FormatHttpResponseOptions = { mode: 'summary' } | { maxBodyChars: number };

/**
 * Agent-facing HTTP response payload with optional body truncation metadata.
 */
export interface AgentHttpResponse {
  /**
   * HTTP status code.
   */
  status: number;

  /**
   * HTTP status text.
   */
  statusText: string;

  /**
   * Response headers.
   */
  headers: Record<string, string>;

  /**
   * Round-trip time in milliseconds.
   */
  timeMs: number;

  /**
   * Response body size in bytes.
   */
  sizeBytes: number;

  /**
   * Error message when the request failed.
   */
  error?: string;

  /**
   * Script test results from the response tab.
   */
  tests: ScriptTestResult[];

  /**
   * Short body preview for summary mode.
   */
  bodyPreview?: string;

  /**
   * Whether the body preview was truncated.
   */
  bodyPreviewTruncated?: boolean;

  /**
   * Full or truncated body when requested.
   */
  body?: string;

  /**
   * Whether the body field was truncated.
   */
  bodyTruncated?: boolean;

  /**
   * Original body length before truncation.
   */
  bodyOriginalLength?: number;
}

/**
 * JMESPath result type label returned to the agent.
 */
export type QueryResultType = 'array' | 'object' | 'string' | 'number' | 'boolean' | 'null';

/**
 * Successful JMESPath query result for agent tools.
 */
export interface QueryResponseBodyResult {
  /**
   * JMESPath expression that was evaluated.
   */
  expression: string;

  /**
   * JavaScript typeof-style label for the matched value.
   */
  resultType: QueryResultType;

  /**
   * Number of matches when the result is an array.
   */
  matchCount?: number;

  /**
   * Full structured result when it fits within the character cap.
   */
  result?: unknown;

  /**
   * Truncated JSON preview when the stringified result exceeds the cap.
   */
  resultPreview?: string;

  /**
   * Whether the stringified result was truncated.
   */
  resultTruncated?: boolean;

  /**
   * Original stringified result length before truncation.
   */
  resultOriginalLength?: number;
}

/**
 * Failed JMESPath query result for agent tools.
 */
export interface QueryResponseBodyError {
  /**
   * Human-readable error message.
   */
  error: string;

  /**
   * Response Content-Type header when JSON parsing fails.
   */
  contentType?: string;
}

/**
 * Resolves the agent-facing result type label for a JMESPath value.
 *
 * @param value - Value returned by JMESPath search.
 */
function resolveQueryResultType(value: unknown): QueryResultType {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  switch (typeof value) {
    case 'object':
      return 'object';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'null';
  }
}

/**
 * Evaluates a JMESPath expression against a JSON response body for agent tools.
 *
 * @param bodyText - Raw response body text expected to be JSON.
 * @param expression - JMESPath expression to evaluate.
 * @param maxResultChars - Maximum stringified result characters to return.
 * @param contentType - Optional Content-Type header for parse error context.
 */
export function queryJsonForAgent(
  bodyText: string,
  expression: string,
  maxResultChars: number = DEFAULT_QUERY_RESULT_CHARS,
  contentType?: string
): QueryResponseBodyResult | QueryResponseBodyError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {
      error: 'Response body is not valid JSON.',
      ...(contentType ? { contentType } : {})
    };
  }

  let value: unknown;
  try {
    value = jmespath.search(parsed, expression);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown expression error.';
    return { error: `Invalid JMESPath expression: ${message}` };
  }

  const resultType = resolveQueryResultType(value);
  const base: QueryResponseBodyResult = {
    expression,
    resultType,
    ...(resultType === 'array' && Array.isArray(value) ? { matchCount: value.length } : {})
  };

  const serialized = JSON.stringify(value);
  if (serialized.length <= maxResultChars) {
    return { ...base, result: value };
  }

  const preview = truncateTextForLlm(serialized, maxResultChars);
  return {
    ...base,
    resultPreview: preview.text,
    resultTruncated: true,
    resultOriginalLength: preview.originalLength
  };
}

/**
 * Truncates text to a maximum character length for LLM payloads.
 *
 * @param text - Source text.
 * @param maxChars - Maximum allowed characters.
 */
export function truncateTextForLlm(text: string, maxChars: number): TruncatedText {
  if (maxChars <= 0) {
    return { text: '', truncated: text.length > 0, originalLength: text.length };
  }
  if (text.length <= maxChars) {
    return { text, truncated: false, originalLength: text.length };
  }
  return {
    text: text.slice(0, maxChars),
    truncated: true,
    originalLength: text.length
  };
}

/**
 * Formats an HTTP response for agent tools in summary or capped full-body mode.
 *
 * @param response - Last send result from the active tab.
 * @param tests - Script test results for the response.
 * @param options - Summary preview or max body character limit.
 */
export function formatHttpResponseForAgent(
  response: SendResult,
  tests: ScriptTestResult[],
  options: FormatHttpResponseOptions
): AgentHttpResponse {
  const preview = truncateTextForLlm(response.body, RESPONSE_BODY_PREVIEW_CHARS);
  const base: AgentHttpResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    timeMs: response.timeMs,
    sizeBytes: response.sizeBytes,
    ...(response.error ? { error: response.error } : {}),
    tests,
    bodyPreview: preview.text,
    ...(preview.truncated
      ? { bodyPreviewTruncated: true, bodyOriginalLength: preview.originalLength }
      : {})
  };

  if ('mode' in options && options.mode === 'summary') {
    return base;
  }

  const maxBodyChars =
    'maxBodyChars' in options ? options.maxBodyChars : DEFAULT_RESPONSE_BODY_CHARS;
  const body = truncateTextForLlm(response.body, maxBodyChars);
  return {
    ...base,
    body: body.text,
    ...(body.truncated ? { bodyTruncated: true, bodyOriginalLength: body.originalLength } : {})
  };
}

/**
 * Shrinks chat step messages to recover from context length overflows.
 *
 * @param messages - Messages from the renderer tool loop.
 * @param aggressive - When true, drops old history and caps message content length.
 */
export function truncateChatStepMessages(
  messages: ChatStepMessage[],
  aggressive: boolean
): ChatStepMessage[] {
  if (!aggressive || messages.length === 0) {
    return messages;
  }

  const trimmed =
    messages.length > AGGRESSIVE_HISTORY_MESSAGE_COUNT
      ? messages.slice(-AGGRESSIVE_HISTORY_MESSAGE_COUNT)
      : [...messages];

  return trimmed.map((message) => {
    if (message.content == null || message.content.length <= AGGRESSIVE_MESSAGE_CONTENT_CHARS) {
      return message;
    }
    const shortened = truncateTextForLlm(message.content, AGGRESSIVE_MESSAGE_CONTENT_CHARS);
    return {
      ...message,
      content: `${shortened.text}\n… [truncated from ${shortened.originalLength} characters]`
    };
  });
}
