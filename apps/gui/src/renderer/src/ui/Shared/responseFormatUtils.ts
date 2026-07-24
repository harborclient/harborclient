import type { BodyType, ScriptExecutionEvent, ScriptTestResult, SendResult } from '#/shared/types';
import {
  formatFlowExecutionDetail,
  formatFlowExecutionLabel,
  formatVariableExecutionDetail,
  formatVariableExecutionLabel
} from '#/renderer/src/ui/Shared/ConsoleDetails/executionEventLabels';

/**
 * Pretty-prints JSON response bodies when valid; returns raw text otherwise.
 *
 * @param body - Raw response body string.
 * @returns Formatted body for display.
 */
export function formatBody(body: string): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/**
 * Formats a sent request body for console display based on body type.
 *
 * @param body - Raw or summarized request body string.
 * @param bodyType - Request body type when known.
 * @returns Formatted body for display.
 */
export function formatSentRequestBody(body: string, bodyType?: BodyType): string {
  if (!body) return '';
  if (bodyType === 'multipart' || bodyType === 'urlencoded') {
    return body;
  }
  return formatBody(body);
}

/**
 * Returns true when the body is valid JSON.
 *
 * @param body - Raw body string.
 */
export function isValidJson(body: string): boolean {
  if (!body.trim()) return false;
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chooses a syntax mode from content-type or JSON validity.
 *
 * @param body - Raw body string.
 * @param headers - Response headers map.
 */
export function bodyLanguage(body: string, headers?: Record<string, string>): 'json' | 'text' {
  const contentType = headers?.['content-type'] ?? headers?.['Content-Type'] ?? '';
  if (contentType.includes('json')) return 'json';
  return isValidJson(body) ? 'json' : 'text';
}

/**
 * CSP injected into HTML preview frames: blocks scripts only; stylesheets and
 * images load freely (iframe sandbox also omits allow-scripts).
 */
const HTML_PREVIEW_CSP =
  "script-src 'none'; script-src-elem 'none'; script-src-attr 'none'; object-src 'none';";

/**
 * CSP meta tag prepended or injected into preview documents.
 */
const HTML_PREVIEW_CSP_META = `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_CSP}">`;

/**
 * Removes Content-Security-Policy meta tags from HTML so they do not intersect
 * with the preview-only policy we inject.
 *
 * @param html - Raw HTML string.
 */
function stripExistingCspMeta(html: string): string {
  return html.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy(?:-Report-Only)?["'][^>]*>/gi,
    ''
  );
}

/**
 * Returns true when the HTML already declares a base URL for relative resolution.
 *
 * @param html - Raw HTML string.
 */
function hasExistingBaseTag(html: string): boolean {
  return /<base\b[^>]*\bhref\s*=/i.test(html);
}

/**
 * Builds head elements injected into preview documents (charset, optional base, CSP).
 *
 * @param html - HTML being wrapped or injected into, used to detect an existing base tag.
 * @param baseUrl - Request URL used to resolve relative asset paths.
 */
function buildPreviewHeadInjection(html: string, baseUrl?: string): string {
  const parts = ['<meta charset="utf-8">'];
  if (baseUrl && !hasExistingBaseTag(html)) {
    parts.push(`<base href="${baseUrl}">`);
  }
  parts.push(HTML_PREVIEW_CSP_META);
  return parts.join('\n');
}

/**
 * Resolves a request URL suitable for a preview base tag.
 *
 * @param requestUrl - URL from the active request draft.
 * @returns Absolute http(s) href, or undefined when the URL is missing or invalid.
 */
export function resolveHtmlPreviewBaseUrl(requestUrl: string): string | undefined {
  const trimmed = requestUrl.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

/**
 * Generic content-types where a body heuristic may still indicate HTML.
 */
const GENERIC_CONTENT_TYPES = new Set(['', 'text/plain', 'application/octet-stream']);

/**
 * Returns true when trimmed body content looks like an HTML document or fragment.
 *
 * @param body - Raw response body string.
 */
function looksLikeHtml(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed.startsWith('<')) return false;
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return true;
  return /<\/(html|body|div|p|span|table|head|title|h[1-6])>/i.test(trimmed);
}

/**
 * Returns true when the response body should offer an HTML preview tab.
 *
 * Uses Content-Type when present; falls back to markup heuristics for mislabeled bodies.
 * Valid JSON is never treated as HTML even when content-type claims HTML.
 *
 * @param body - Raw response body string.
 * @param headers - Response headers map.
 */
export function isHtmlResponse(body: string, headers?: Record<string, string>): boolean {
  if (!body.trim()) return false;
  if (isValidJson(body)) return false;

  const contentType = (headers?.['content-type'] ?? headers?.['Content-Type'] ?? '').toLowerCase();
  if (contentType.includes('html')) return true;

  if (!GENERIC_CONTENT_TYPES.has(contentType)) return false;
  return looksLikeHtml(body);
}

/**
 * Returns the response Content-Type header value, or an empty string when absent.
 *
 * @param headers - Response headers map.
 */
export function responseContentType(headers?: Record<string, string>): string {
  return headers?.['content-type'] ?? headers?.['Content-Type'] ?? '';
}

/**
 * Returns true when the response Content-Type indicates an image body.
 *
 * @param headers - Response headers map.
 */
export function isImageResponse(headers?: Record<string, string>): boolean {
  return responseContentType(headers).toLowerCase().startsWith('image/');
}

/**
 * Chooses the initial response tab when the editor mounts or remounts.
 *
 * HTML and image responses open on Preview so rendered content is visible
 * immediately; everything else defaults to Body.
 *
 * @param response - Last send result, or null before the first send.
 * @returns Tab value for `SegmentedTabsGroup`.
 */
export function defaultResponseTab(
  response: {
    body: string;
    headers?: Record<string, string>;
  } | null
): string {
  if (!response) return 'body';
  if (isHtmlResponse(response.body, response.headers) || isImageResponse(response.headers)) {
    return 'preview';
  }
  return 'body';
}

/**
 * Wraps an HTML fragment in a minimal document shell with preview CSP.
 *
 * @param body - Raw HTML fragment.
 * @param baseUrl - Request URL used to resolve relative asset paths.
 */
function wrapHtmlFragment(body: string, baseUrl?: string): string {
  const stripped = stripExistingCspMeta(body);
  const headInjection = buildPreviewHeadInjection(stripped, baseUrl);
  return `<!DOCTYPE html>
<html>
<head>
${headInjection}
</head>
<body>
${stripped}
</body>
</html>`;
}

/**
 * Injects preview CSP into a full HTML document, adding head when missing.
 *
 * @param body - Raw full HTML document string.
 * @param baseUrl - Request URL used to resolve relative asset paths.
 */
function injectCspIntoHtmlDocument(body: string, baseUrl?: string): string {
  const trimmed = stripExistingCspMeta(body.trim());
  const headInjection = buildPreviewHeadInjection(trimmed, baseUrl);
  const headMatch = /<head(\s[^>]*)?>/i.exec(trimmed);
  if (headMatch) {
    const insertAt = headMatch.index + headMatch[0].length;
    return `${trimmed.slice(0, insertAt)}\n${headInjection}\n${trimmed.slice(insertAt)}`;
  }

  const htmlMatch = /<html(\s[^>]*)?>/i.exec(trimmed);
  if (htmlMatch) {
    const insertAt = htmlMatch.index + htmlMatch[0].length;
    return `${trimmed.slice(0, insertAt)}\n<head>\n${headInjection}\n</head>\n${trimmed.slice(insertAt)}`;
  }

  return wrapHtmlFragment(trimmed, baseUrl);
}

/**
 * Builds sandboxed iframe srcdoc content for an HTML response preview.
 *
 * Strips conflicting server CSP, injects a script-blocking policy, and optionally
 * adds a base URL so relative stylesheets and images resolve against the request.
 *
 * @param body - Raw response body string.
 * @param baseUrl - Request URL used to resolve relative asset paths.
 * @returns HTML document for rendering in a sandboxed iframe via srcdoc.
 */
export function buildHtmlPreviewSrcdoc(body: string, baseUrl?: string): string {
  const trimmed = body.trim();
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return injectCspIntoHtmlDocument(trimmed, baseUrl);
  }
  return wrapHtmlFragment(trimmed, baseUrl);
}

/**
 * Chooses a syntax mode for a sent request body based on body type and headers.
 *
 * @param body - Raw or summarized request body string.
 * @param bodyType - Request body type when known.
 * @param headers - Request headers map.
 */
export function sentRequestBodyLanguage(
  body: string,
  bodyType?: BodyType,
  headers?: Record<string, string>
): 'json' | 'text' {
  if (bodyType === 'multipart' || bodyType === 'urlencoded') {
    return 'text';
  }
  return bodyLanguage(body, headers);
}

/**
 * Section title for a sent request body in the console inspector.
 *
 * @param bodyType - Request body type when known.
 */
export function sentRequestBodySectionTitle(bodyType?: BodyType): string {
  return bodyType === 'multipart' ? 'Form Data' : 'Payload';
}

/**
 * Formats a byte count as B, KB, or MB.
 *
 * @param bytes - Response body size in bytes.
 * @returns Human-readable size string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One request header entry in response exports.
 */
export interface ResponseExportHeader {
  key: string;
  value: string;
}

/**
 * Outgoing request metadata included in response exports.
 */
export interface ResponseExportRequest {
  method: string;
  url: string;
  headers: ResponseExportHeader[];
}

/**
 * Parsed or raw response body included in response exports.
 */
export type ResponseExportBody = unknown;

/**
 * Timing summary exported with the full response payload.
 */
export interface ResponseExportTiming {
  totalTime: number;
  size: number;
  stalledMs?: number;
  connectMs?: number;
  requestSentMs?: number;
  waitingMs?: number;
  downloadMs?: number;
}

/**
 * Console output and trace data included in response exports.
 */
export interface ResponseExportConsole {
  output: string;
  traces: string[];
  error?: string;
}

/**
 * One hc.test result in response exports.
 */
export interface ResponseExportTest {
  label: string;
  success: boolean;
  output: string;
}

/**
 * HarborClient portable export payload for a full HTTP response.
 */
export interface ResponseExportPayload {
  harborclientVersion: 1;
  harborclientExport: 'response';
  request: ResponseExportRequest;
  body: ResponseExportBody;
  headers: Record<string, string>;
  timing: ResponseExportTiming;
  console: ResponseExportConsole;
  tests: ResponseExportTest[];
}

/**
 * Serializes one script execution event as a trace line matching the console Trace panel.
 *
 * @param event - Variable or flow-control activity from script execution.
 * @returns Human-readable trace string for export.
 */
function formatExecutionEventTrace(event: ScriptExecutionEvent): string {
  const label =
    event.type === 'variable'
      ? formatVariableExecutionLabel(event)
      : formatFlowExecutionLabel(event);
  const detail =
    event.type === 'variable'
      ? formatVariableExecutionDetail(event)
      : formatFlowExecutionDetail(event);

  const parts: string[] = [];
  if (event.scriptName) {
    parts.push(`[${event.scriptName}]`);
  }
  parts.push(label);
  if (detail) {
    parts.push('-', detail);
  }
  return parts.join(' ');
}

/**
 * Chooses the export body value from raw response text.
 *
 * @param body - Raw response body string.
 * @returns Parsed JSON when valid, raw string otherwise, or null when empty.
 */
function responseExportBody(body: string): ResponseExportBody {
  if (!body) {
    return null;
  }
  if (isValidJson(body)) {
    return JSON.parse(body) as unknown;
  }
  return body;
}

/**
 * Builds request metadata for full response export.
 *
 * @param response - Last send result to export.
 * @param requestUrlFallback - Draft URL used when sent-request metadata is absent.
 * @returns Outgoing request method, URL, and headers as key/value pairs.
 */
function buildResponseExportRequest(
  response: SendResult,
  requestUrlFallback?: string
): ResponseExportRequest {
  if (response.request) {
    return {
      method: response.request.method,
      url: response.request.url,
      headers: Object.entries(response.request.headers).map(([key, value]) => ({ key, value }))
    };
  }

  return {
    method: 'GET',
    url: requestUrlFallback ?? '',
    headers: []
  };
}

/**
 * Builds timing object for full response export.
 *
 * @param response - Last send result.
 * @returns Timing summary with total time, size, and optional phase breakdown.
 */
function buildResponseExportTiming(response: SendResult): ResponseExportTiming {
  const timing: ResponseExportTiming = {
    totalTime: response.timeMs,
    size: response.sizeBytes
  };

  if (response.timing?.stalledMs != null) {
    timing.stalledMs = response.timing.stalledMs;
  }
  if (response.timing?.connectMs != null) {
    timing.connectMs = response.timing.connectMs;
  }
  if (response.timing?.requestSentMs != null) {
    timing.requestSentMs = response.timing.requestSentMs;
  }
  if (response.timing?.waitingMs != null) {
    timing.waitingMs = response.timing.waitingMs;
  }
  if (response.timing?.downloadMs != null) {
    timing.downloadMs = response.timing.downloadMs;
  }

  return timing;
}

/**
 * Builds the console section for full response export.
 *
 * @param scriptLogs - Console output captured from scripts.
 * @param executionEvents - Ordered variable and flow-control activity.
 * @param scriptError - Aggregated script runtime errors, when present.
 * @returns Console output, formatted traces, and optional error text.
 */
function buildResponseExportConsole(
  scriptLogs: readonly string[],
  executionEvents: readonly ScriptExecutionEvent[],
  scriptError?: string
): ResponseExportConsole {
  const console: ResponseExportConsole = {
    output: scriptLogs.join('\n'),
    traces: executionEvents.map(formatExecutionEventTrace)
  };
  if (scriptError) {
    console.error = scriptError;
  }
  return console;
}

/**
 * Maps hc.test results into response export test entries.
 *
 * @param testResults - hc.test results from the last send.
 * @returns Export test rows with label, success, and output text.
 */
function buildResponseExportTests(testResults: readonly ScriptTestResult[]): ResponseExportTest[] {
  return testResults.map((test) => {
    let output = test.name;
    if (!test.passed && test.error) {
      output += ` — ${test.error}`;
    }
    return {
      label: test.scriptName ?? 'Script',
      success: test.passed,
      output
    };
  });
}

/**
 * Assembles a HarborClient response export payload from send result and script output.
 *
 * @param response - Last send result to export.
 * @param testResults - hc.test results from the last send.
 * @param scriptLogs - Console output captured from scripts.
 * @param executionEvents - Ordered variable and flow-control activity.
 * @param scriptError - Aggregated script runtime errors, when present.
 * @param requestUrlFallback - Draft URL used when sent-request metadata is absent.
 * @returns Full response export object for copy or file export.
 */
export function buildResponseExport(
  response: SendResult,
  testResults: readonly ScriptTestResult[],
  scriptLogs: readonly string[],
  executionEvents: readonly ScriptExecutionEvent[],
  scriptError?: string,
  requestUrlFallback?: string
): ResponseExportPayload {
  return {
    harborclientVersion: 1,
    harborclientExport: 'response',
    request: buildResponseExportRequest(response, requestUrlFallback),
    body: responseExportBody(response.body),
    headers: response.headers,
    timing: buildResponseExportTiming(response),
    console: buildResponseExportConsole(scriptLogs, executionEvents, scriptError),
    tests: buildResponseExportTests(testResults)
  };
}
