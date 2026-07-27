import {
  AI_RESPONSE_SECTION_LABELS,
  buildResponseSectionReferenceToken,
  type AiResponseSection,
  type ResponseSectionSnapshot
} from '@harborclient/core/ai/scriptReferences';
import { DEFAULT_RESPONSE_BODY_CHARS, truncateTextForLlm } from '@harborclient/core/ai/chatContext';
import type {
  ScriptExecutionEvent,
  ScriptRunError,
  ScriptTestResult
} from '@harborclient/core/types';
import type { SendResult } from '@harborclient/http';
import { formatResponseHeadersForDiff } from '#/renderer/src/ui/Main/ResponseEditor/responseHistoryDiff';
import { buildTimingRows } from '#/renderer/src/ui/Main/ResponseEditor/timingDisplay';
import {
  formatBody,
  formatBytes,
  isImageResponse
} from '#/renderer/src/ui/Shared/responseFormatUtils';

/**
 * Inputs needed to build an `@res` snapshot for one response-viewer section.
 */
export interface BuildResponseSectionReferenceInput {
  /**
   * UUID of the owning request tab.
   */
  requestTabId: string;

  /**
   * Display name of the request at capture time.
   */
  requestName: string;

  /**
   * Which response-viewer section to capture.
   */
  section: AiResponseSection;

  /**
   * Latest HTTP send result on the request tab.
   */
  response: SendResult;

  /**
   * hc.test results from the last send.
   */
  testResults?: ScriptTestResult[];

  /**
   * Console log lines from scripts for the last send.
   */
  scriptLogs?: string[];

  /**
   * Ordered variable and flow-control activity from scripts.
   */
  executionEvents?: ScriptExecutionEvent[];

  /**
   * Aggregated script runtime error message, when present.
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata.
   */
  scriptErrors?: ScriptRunError[];
}

/**
 * Token plus snapshot produced when copying a response section to chat.
 */
export interface ResponseSectionReference {
  /**
   * Compact `@res.<tab-uuid>.<section>` token for the composer.
   */
  token: string;

  /**
   * Captured section content for send-time agent context.
   */
  snapshot: ResponseSectionSnapshot;
}

/**
 * Formats status and status text for response-section snapshots.
 *
 * @param response - Latest send result.
 * @returns Status line such as `200 OK`, or null when status is unavailable.
 */
function formatStatusLine(response: SendResult): string | null {
  if (response.status <= 0 && !response.statusText) {
    return null;
  }

  return `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`.trim();
}

/**
 * Builds plain-text content for the response body section.
 *
 * @param response - Latest send result.
 * @returns Body text with optional truncation metadata.
 */
function buildBodyContent(response: SendResult): {
  content: string;
  truncated?: boolean;
  originalLength?: number;
} {
  if (isImageResponse(response.headers)) {
    const contentType =
      Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ??
      'image';
    return {
      content: `Image response (${contentType}, ${formatBytes(response.sizeBytes)}). Binary body omitted.`
    };
  }

  const formatted = formatBody(response.body) || '(empty body)';
  const truncated = truncateTextForLlm(formatted, DEFAULT_RESPONSE_BODY_CHARS);
  return {
    content: truncated.text,
    ...(truncated.truncated ? { truncated: true, originalLength: truncated.originalLength } : {})
  };
}

/**
 * Builds plain-text content for the response headers section.
 *
 * @param response - Latest send result.
 * @returns Header dump with status preface.
 */
function buildHeadersContent(response: SendResult): string {
  const status = formatStatusLine(response);
  const headers = formatResponseHeadersForDiff(response.headers) || '(no headers)';
  return status != null ? `${status}\n\n${headers}` : headers;
}

/**
 * Builds plain-text content for the timing section.
 *
 * @param response - Latest send result.
 * @returns Total time, size, and phase breakdown.
 */
function buildTimingContent(response: SendResult): string {
  const lines = [`Total time: ${response.timeMs} ms`, `Size: ${formatBytes(response.sizeBytes)}`];
  const rows = buildTimingRows(response.timing, response.timeMs);
  if (rows.length === 0) {
    lines.push('Phase timing is unavailable for this response.');
    return lines.join('\n');
  }

  lines.push('Phases:');
  for (const row of rows) {
    lines.push(`- ${row.label}: ${row.durationMs} ms (start ${row.startMs} ms)`);
  }
  return lines.join('\n');
}

/**
 * Formats one script execution event for console snapshots.
 *
 * @param event - Variable or flow-control event from the last send.
 * @returns Single-line description.
 */
function formatExecutionEvent(event: ScriptExecutionEvent): string {
  if (event.type === 'variable') {
    const script = event.scriptName ? ` [${event.scriptName}]` : '';
    const value = event.value != null ? ` = ${event.value}` : '';
    return `variable ${event.action} ${event.scope}.${event.key}${value}${script}`;
  }

  const script = event.scriptName ? ` [${event.scriptName}]` : '';
  const next =
    event.nextRequest === undefined
      ? ''
      : event.nextRequest == null
        ? ' (stop)'
        : ` → ${event.nextRequest}`;
  return `flow ${event.action}${next}${script}`;
}

/**
 * Builds plain-text content for the console section.
 *
 * @param input - Response and script diagnostics for the last send.
 * @returns Console dump including logs, errors, and execution events.
 */
function buildConsoleContent(input: BuildResponseSectionReferenceInput): string {
  const { response } = input;
  const lines: string[] = [];
  const status = formatStatusLine(response);
  if (status != null) {
    lines.push(`Status: ${status}`);
  }
  if (response.error) {
    lines.push(`Transport error: ${response.error}`);
  }

  const logs = input.scriptLogs ?? [];
  if (logs.length > 0) {
    lines.push('Script logs:');
    for (const log of logs) {
      lines.push(`- ${log}`);
    }
  } else {
    lines.push('Script logs: (none)');
  }

  if (input.scriptError) {
    lines.push(`Script error: ${input.scriptError}`);
  }

  const scriptErrors = input.scriptErrors ?? [];
  if (scriptErrors.length > 0) {
    lines.push('Script errors:');
    for (const error of scriptErrors) {
      const location =
        error.line != null
          ? ` at ${error.source ?? 'script.js'}:${error.line}${
              error.column != null ? `:${error.column}` : ''
            }`
          : '';
      const script = error.scriptName ? ` [${error.scriptName}]` : '';
      lines.push(`- ${error.message}${location}${script}`);
    }
  }

  const events = input.executionEvents ?? [];
  if (events.length > 0) {
    lines.push('Execution events:');
    for (const event of events) {
      lines.push(`- ${formatExecutionEvent(event)}`);
    }
  }

  const tests = input.testResults ?? [];
  if (tests.length > 0) {
    const passed = tests.filter((test) => test.passed).length;
    lines.push(`Tests: ${passed}/${tests.length} passed`);
  }

  return lines.join('\n');
}

/**
 * Builds plain-text content for the tests section.
 *
 * @param testResults - hc.test results from the last send.
 * @returns Pass/fail list with failure details.
 */
function buildTestsContent(testResults: ScriptTestResult[]): string {
  if (testResults.length === 0) {
    return 'No tests ran for this response.';
  }

  const passed = testResults.filter((test) => test.passed).length;
  const lines = [`${passed}/${testResults.length} passed`];

  for (const test of testResults) {
    const status = test.passed ? 'PASS' : 'FAIL';
    const location =
      test.line != null
        ? ` (${test.source ?? 'script.js'}:${test.line}${
            test.column != null ? `:${test.column}` : ''
          })`
        : '';
    lines.push(`- [${status}] ${test.name}${location}`);
    if (!test.passed && test.error) {
      lines.push(`  error: ${test.error}`);
    }
    if (!test.passed && (test.expected != null || test.actual != null)) {
      const parts: string[] = [];
      if (test.expected != null) {
        parts.push(`expected ${test.expected}`);
      }
      if (test.actual != null) {
        parts.push(`got ${test.actual}`);
      }
      lines.push(`  ${parts.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Builds an `@res` token and snapshot for one response-viewer section.
 *
 * Captures section content at click time so send-time context expansion still
 * works if the response is cleared or the user switches tabs before sending.
 *
 * @param input - Live response data from the owning request tab.
 * @returns Token and snapshot ready to store and insert into the composer.
 */
export function buildResponseSectionReference(
  input: BuildResponseSectionReferenceInput
): ResponseSectionReference {
  const token = buildResponseSectionReferenceToken(input.requestTabId, input.section);
  const label = AI_RESPONSE_SECTION_LABELS[input.section];

  let content: string;
  let truncated: boolean | undefined;
  let originalLength: number | undefined;

  switch (input.section) {
    case 'body': {
      const body = buildBodyContent(input.response);
      content = body.content;
      truncated = body.truncated;
      originalLength = body.originalLength;
      break;
    }
    case 'headers':
      content = buildHeadersContent(input.response);
      break;
    case 'timing':
      content = buildTimingContent(input.response);
      break;
    case 'console':
      content = buildConsoleContent(input);
      break;
    case 'tests':
      content = buildTestsContent(input.testResults ?? []);
      break;
  }

  return {
    token,
    snapshot: {
      label,
      requestName: input.requestName,
      section: input.section,
      ...(input.response.status > 0 ? { status: input.response.status } : {}),
      ...(input.response.statusText ? { statusText: input.response.statusText } : {}),
      content,
      ...(truncated ? { truncated: true, originalLength } : {})
    }
  };
}

/**
 * Whether a response-viewer tab id is a copy-to-chat `@res` section.
 *
 * @param tab - Candidate viewer tab id.
 * @returns True for body, headers, timing, console, or tests.
 */
export function isAiResponseSection(tab: string): tab is AiResponseSection {
  return (
    tab === 'body' || tab === 'headers' || tab === 'timing' || tab === 'console' || tab === 'tests'
  );
}
