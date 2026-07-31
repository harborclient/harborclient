import type {
  KeyValue,
  ScriptExecutionEvent,
  ScriptLogEntry,
  ScriptRunError,
  ScriptTestResult,
  SendResult,
  WorkflowRunRequestResult
} from '@harborclient/core/types';
import { coerceScriptLogs } from '@harborclient/core/scripting/scriptLogs';

/**
 * Response Editor fields derived from a portable workflow-run request result.
 */
export interface WorkflowRunRequestResultEditorModel {
  /**
   * Synthetic send result for Body / Headers / Timing tabs.
   */
  response: SendResult;

  /**
   * hc.test assertion results from the send.
   */
  testResults: ScriptTestResult[];

  /**
   * Script console lines captured at send time.
   */
  scriptLogs: ScriptLogEntry[];

  /**
   * Ordered variable and flow-control events from scripts.
   */
  executionEvents: ScriptExecutionEvent[];

  /**
   * Aggregated script runtime error text, when any.
   */
  scriptError?: string;

  /**
   * Structured script failures, when any.
   */
  scriptErrors?: ScriptRunError[];

  /**
   * Request URL used for HTML preview base resolution.
   */
  requestUrl: string;
}

/**
 * Converts key/value header rows into a flat header map (last value wins per key).
 *
 * @param rows - Portable header rows.
 * @returns Flat header map.
 */
function keyValuesToHeaderRecord(rows: KeyValue[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of rows) {
    if (!row.enabled) {
      continue;
    }
    headers[row.key] = row.value;
  }
  return headers;
}

/**
 * Reads the Content-Type MIME (without parameters) from a flat header map.
 *
 * @param headers - Flat response headers.
 * @returns Lowercased type/subtype, or empty string when missing.
 */
function contentTypeMime(headers: Record<string, string>): string {
  const raw = headers['content-type'] ?? headers['Content-Type'] ?? '';
  return raw.toLowerCase().split(';')[0]?.trim() ?? '';
}

/**
 * Returns true when a portable response body was stored as base64 for a binary payload.
 *
 * Uses Content-Type heuristics matching the HTTP transport encoding rules: images and
 * other non-textual types map to `bodyBase64`; JSON/HTML/text stay as `body`.
 *
 * @param contentType - Normalized MIME type.
 * @param body - Portable `response.body` string (text or base64).
 * @returns True when {@link body} should be exposed as `SendResult.bodyBase64`.
 */
function shouldTreatPortableBodyAsBase64(contentType: string, body: string): boolean {
  if (
    contentType.startsWith('image/') ||
    contentType.startsWith('audio/') ||
    contentType.startsWith('video/')
  ) {
    return true;
  }

  if (contentType.startsWith('text/')) {
    return false;
  }
  if (
    contentType.includes('json') ||
    contentType.includes('html') ||
    contentType.includes('xml') ||
    contentType.includes('javascript') ||
    contentType.includes('ecmascript') ||
    contentType === 'application/x-www-form-urlencoded'
  ) {
    return false;
  }

  if (contentType === '' || contentType === 'application/octet-stream') {
    if (!body) {
      return false;
    }
    try {
      JSON.parse(body);
      return false;
    } catch {
      // Not JSON — continue.
    }
    const trimmed = body.trim();
    if (trimmed.startsWith('<')) {
      return false;
    }
    return true;
  }

  return true;
}

/**
 * Maps a portable workflow-run request result into Response Editor props.
 *
 * Reconstructs a {@link SendResult} from nested timing/headers/body fields and
 * forwards script console diagnostics recorded on the portable response.
 *
 * @param result - Portable request+response snapshot from the run log.
 * @returns Editor model ready for {@link ResponseEditor}.
 */
export function workflowRunRequestResultToEditorModel(
  result: WorkflowRunRequestResult
): WorkflowRunRequestResultEditorModel {
  const headers = keyValuesToHeaderRecord(result.response.headers);
  const mime = contentTypeMime(headers);
  const asBase64 = shouldTreatPortableBodyAsBase64(mime, result.response.body);
  const timing = result.response.timing;

  const response: SendResult = {
    status: result.response.status,
    statusText: result.response.statusText,
    headers,
    body: asBase64 ? '' : result.response.body,
    ...(asBase64 ? { bodyBase64: result.response.body } : {}),
    timeMs: timing.totalTime,
    sizeBytes: timing.size ?? 0,
    timing: {
      ...(timing.stalledMs != null ? { stalledMs: timing.stalledMs } : {}),
      ...(timing.connectMs != null ? { connectMs: timing.connectMs } : {}),
      ...(timing.requestSentMs != null ? { requestSentMs: timing.requestSentMs } : {}),
      ...(timing.waitingMs != null ? { waitingMs: timing.waitingMs } : {}),
      ...(timing.downloadMs != null ? { downloadMs: timing.downloadMs } : {})
    },
    request: {
      method: result.method,
      url: result.url,
      headers: keyValuesToHeaderRecord(result.headers),
      body: result.body
    }
  };

  return {
    response,
    testResults: result.response.tests,
    scriptLogs: coerceScriptLogs(result.response.scriptLogs ?? []),
    executionEvents: result.response.executionEvents ?? [],
    scriptError: result.response.scriptError,
    scriptErrors: result.response.scriptErrors,
    requestUrl: result.url
  };
}
