import type { RequestHistoryEntry } from '@harborclient/core/types/requestHistory';
import type { SendResult } from '@harborclient/http';
import type { CodeEditorLanguage } from '@harborclient/sdk/components';
import {
  bodyLanguage,
  formatBody,
  isBinaryResponse,
  isImageResponse
} from '#/renderer/src/ui/Shared/responseFormatUtils';

/**
 * Formatted previous/current documents ready for an inline response Diff view.
 */
export interface ResponseDiffContent {
  /**
   * Short title describing whether this is a body or headers Diff.
   */
  title: string;

  /**
   * Left-pane document (selected history baseline).
   */
  previous: string;

  /**
   * Right-pane document (current response).
   */
  current: string;

  /**
   * Syntax mode for both panes.
   */
  language: CodeEditorLanguage;
}

/**
 * Viewer tabs that support Diff against prior response history.
 */
export type ResponseDiffKind = 'body' | 'headers';

/**
 * Criteria used to match prior history entries to the active request.
 */
export interface ResponseHistoryMatchTarget {
  /**
   * Saved collection request id when the active tab edits a persisted request.
   */
  savedRequestId?: number;

  /**
   * HTTP method of the active request draft.
   */
  method: string;

  /**
   * URL of the active request draft (without query string).
   */
  url: string;
}

/**
 * Returns true when the history entry belongs to the same logical request.
 *
 * Prefers `savedRequestId` when both sides have one; otherwise matches method + URL.
 *
 * @param entry - Candidate history row.
 * @param target - Active request identity.
 */
export function isSameRequestHistoryEntry(
  entry: RequestHistoryEntry,
  target: ResponseHistoryMatchTarget
): boolean {
  if (entry.kind === 'run') {
    return false;
  }

  if (target.savedRequestId != null && entry.savedRequestId != null) {
    return entry.savedRequestId === target.savedRequestId;
  }

  return entry.method.toUpperCase() === target.method.toUpperCase() && entry.url === target.url;
}

/**
 * Returns true when a history entry has response headers captured for Diff.
 *
 * @param entry - Candidate history row.
 */
export function hasResponseHeadersForDiff(entry: RequestHistoryEntry): boolean {
  return entry.responseHeaders != null;
}

/**
 * Returns true when a history entry has a text response body captured for Diff.
 *
 * @param entry - Candidate history row.
 */
export function hasResponseBodyForDiff(entry: RequestHistoryEntry): boolean {
  return entry.responseBody != null;
}

/**
 * Filters history to prior comparable sends for the active request.
 *
 * Matching entries are ordered newest-first. The newest matching entry is
 * excluded because it is the just-recorded current send.
 *
 * @param history - Full request history list (newest first).
 * @param target - Active request identity.
 * @param kind - Whether body or headers Diff content is required.
 * @returns Prior entries that can be selected for Diff, newest first.
 */
export function priorResponseHistoryForDiff(
  history: RequestHistoryEntry[],
  target: ResponseHistoryMatchTarget,
  kind: ResponseDiffKind
): RequestHistoryEntry[] {
  const matching = history.filter((entry) => {
    if (!isSameRequestHistoryEntry(entry, target)) {
      return false;
    }
    if (!hasResponseHeadersForDiff(entry)) {
      return false;
    }
    if (kind === 'body' && !hasResponseBodyForDiff(entry)) {
      return false;
    }
    return true;
  });

  return matching.slice(1);
}

/**
 * Returns whether the Diff action should be enabled for the current response.
 *
 * @param response - Current send result shown in the viewer.
 * @param priorEntries - Prior history entries from {@link priorResponseHistoryForDiff}.
 */
export function canDiffResponse(
  response: SendResult | null | undefined,
  priorEntries: RequestHistoryEntry[]
): boolean {
  if (response == null || priorEntries.length === 0) {
    return false;
  }
  if (isImageResponse(response.headers) || isBinaryResponse(response)) {
    return false;
  }
  return true;
}

/**
 * Serializes response headers into stable sorted `Name: value` lines for Diff.
 *
 * @param headers - Response header map.
 * @returns Multiline header text with keys sorted case-insensitively.
 */
export function formatResponseHeadersForDiff(headers: Record<string, string>): string {
  return Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

/**
 * Builds previous/current Diff documents for a chosen history baseline.
 *
 * @param kind - Whether the Diff targets response body or headers.
 * @param response - Current send result shown in the viewer.
 * @param baselineEntry - Prior history entry selected as the Diff baseline.
 * @returns Formatted Diff documents, or null when the baseline is missing.
 */
export function buildResponseDiffContent(
  kind: ResponseDiffKind,
  response: SendResult,
  baselineEntry: RequestHistoryEntry | null
): ResponseDiffContent | null {
  if (baselineEntry == null) {
    return null;
  }

  if (kind === 'headers') {
    return {
      title: 'Headers diff',
      previous: formatResponseHeadersForDiff(baselineEntry.responseHeaders ?? {}),
      current: formatResponseHeadersForDiff(response.headers),
      language: 'text'
    };
  }

  const previousBody = baselineEntry.responseBody ?? '';
  return {
    title: 'Body diff',
    previous: formatBody(previousBody) || '(empty body)',
    current: formatBody(response.body) || '(empty body)',
    language: bodyLanguage(response.body, response.headers)
  };
}
