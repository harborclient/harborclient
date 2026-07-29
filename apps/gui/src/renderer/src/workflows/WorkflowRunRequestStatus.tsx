import type { WorkflowRunRequestResult } from '@harborclient/core/types';
import { StatusDot } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { statusDotVariant } from '#/renderer/src/ui/Shared/classes';
import { formatBytes } from '#/renderer/src/ui/Shared/responseFormatUtils';

interface Props {
  /**
   * Portable request+response snapshot from a workflow send step.
   */
  result: WorkflowRunRequestResult;

  /**
   * Optional class names for the metrics row (e.g. `ms-auto`).
   */
  className?: string;
}

/**
 * Compact HTTP status, timing, and size metrics for a workflow-run send result.
 *
 * Mirrors the left side of {@link ResponseSummary} for use inside Results rows
 * and registry send thumbnails.
 *
 * @param props - Request result and optional layout class names.
 * @returns Status dot, code text, duration, and size metrics.
 */
export function WorkflowRunRequestStatus({ result, className }: Props): JSX.Element {
  const { status, statusText, timing } = result.response;
  const timeMs = timing.totalTime;
  const sizeBytes = timing.size ?? 0;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-3 text-[14px] ${className ?? ''}`}
      aria-label={`Response status: ${status} ${statusText}. Response time: ${timeMs} milliseconds. Response size: ${formatBytes(sizeBytes)}`}
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-text">
        <StatusDot variant={statusDotVariant(status)} />
        {status} {statusText}
      </span>
      <span className="text-muted">{timeMs} ms</span>
      <span className="text-muted">{formatBytes(sizeBytes)}</span>
    </span>
  );
}
