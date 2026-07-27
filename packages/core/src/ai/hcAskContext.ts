import { RESPONSE_BODY_PREVIEW_CHARS, truncateTextForLlm } from './chatContext';
import type { KeyValue, ScriptRequestContext, ScriptRunInput, SendResult } from '../types';

/**
 * System prompt for one-shot `hc.ask` completions from request scripts.
 *
 * Instructs the model to answer from the injected HarborClient send context
 * (request and, in post-request scripts, response metadata such as sizeBytes).
 */
export const HC_ASK_SYSTEM_PROMPT =
  'You answer the user prompt directly and concisely using the HarborClient send ' +
  'context provided in the conversation. Do not call tools. Do not invent values that ' +
  'are missing from the context. For binary or image response bodies, trust sizeBytes ' +
  'and response headers rather than body text. Return only the answer text with no ' +
  'preamble about being an AI assistant.';

/**
 * Returns the shared `hc.ask` system prompt.
 *
 * @returns System prompt text for the completion step.
 */
export function buildHcAskSystemPrompt(): string {
  return HC_ASK_SYSTEM_PROMPT;
}

/**
 * Formats enabled key/value rows as a compact map for the LLM context.
 *
 * @param rows - Header or param rows from the script request.
 * @returns Object of enabled key → value entries.
 */
function enabledKeyValueMap(rows: KeyValue[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.enabled === false) {
      continue;
    }
    const key = row.key.trim();
    if (!key) {
      continue;
    }
    result[key] = row.value;
  }
  return result;
}

/**
 * Builds a compact request snapshot for `hc.ask` context.
 *
 * @param request - Request context from the active script run.
 * @returns JSON-serializable request summary.
 */
function summarizeRequest(request: ScriptRequestContext): Record<string, unknown> {
  const bodyPreview = truncateTextForLlm(request.body, RESPONSE_BODY_PREVIEW_CHARS);
  return {
    method: request.method,
    url: request.url,
    headers: enabledKeyValueMap(request.headers),
    params: enabledKeyValueMap(request.params),
    bodyType: request.bodyType,
    bodyPreview: bodyPreview.text,
    ...(bodyPreview.truncated
      ? { bodyPreviewTruncated: true, bodyOriginalLength: bodyPreview.originalLength }
      : {})
  };
}

/**
 * Returns whether a response should be treated as binary/image for LLM context.
 *
 * @param response - Send result from the script run.
 */
function isBinaryOrImageResponse(response: SendResult): boolean {
  if (response.bodyBase64 != null && response.bodyBase64.length > 0) {
    return true;
  }
  const contentType =
    response.headers['content-type'] ??
    response.headers['Content-Type'] ??
    Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ??
    '';
  return contentType.toLowerCase().startsWith('image/');
}

/**
 * Builds a compact response snapshot for `hc.ask` context.
 *
 * Omits base64 image payloads; always includes sizeBytes so file-size questions
 * can be answered without the raw body.
 *
 * @param response - Send result from the script run.
 * @returns JSON-serializable response summary.
 */
function summarizeResponse(response: SendResult): Record<string, unknown> {
  const binary = isBinaryOrImageResponse(response);
  const base: Record<string, unknown> = {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    timeMs: response.timeMs,
    sizeBytes: response.sizeBytes,
    ...(response.error ? { error: response.error } : {})
  };

  if (binary) {
    return {
      ...base,
      bodyKind: 'binary',
      note: 'Response body is binary/image; base64 content is omitted. Use sizeBytes for file size.'
    };
  }

  const bodyPreview = truncateTextForLlm(response.body, RESPONSE_BODY_PREVIEW_CHARS);
  return {
    ...base,
    bodyPreview: bodyPreview.text,
    ...(bodyPreview.truncated
      ? { bodyPreviewTruncated: true, bodyOriginalLength: bodyPreview.originalLength }
      : {})
  };
}

/**
 * Builds the send-context message injected before the user prompt for `hc.ask`.
 *
 * Includes the script phase and request snapshot. Includes the response snapshot
 * when present (typical for post-request scripts).
 *
 * @param input - Active script run input from the pending utility-process run.
 * @returns Markdown message content for a user-role preamble, or empty when no input.
 */
export function buildHcAskContextMessage(input: ScriptRunInput | undefined): string {
  if (!input) {
    return '';
  }

  const payload: Record<string, unknown> = {
    phase: input.phase,
    request: summarizeRequest(input.request)
  };

  if (input.response) {
    payload.response = summarizeResponse(input.response);
  }

  if (input.collection?.name) {
    payload.collectionName = input.collection.name;
  }
  if (input.environment?.name) {
    payload.environmentName = input.environment.name;
  }
  if (input.info?.requestName) {
    payload.requestName = input.info.requestName;
  }

  return (
    'HarborClient send context for this hc.ask call (JSON):\n```json\n' +
    JSON.stringify(payload, null, 2) +
    '\n```'
  );
}
