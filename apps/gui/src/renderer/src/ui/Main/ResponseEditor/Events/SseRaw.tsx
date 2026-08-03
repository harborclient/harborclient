import type { JSX } from 'react';
import type { SseEvent } from '@harborclient/core/types';
import { EmptySectionLabel } from '@harborclient/sdk/components';

interface Props {
  /**
   * Retained SSE events whose raw blocks are concatenated.
   */
  events: SseEvent[];
}

/**
 * Raw SSE tab: concatenated event wire blocks joined by blank lines.
 *
 * @param props - Session events to render.
 * @returns Read-only raw stream text.
 */
export function SseRaw({ events }: Props): JSX.Element {
  /**
   * Concatenated raw payload for copy/inspection.
   */
  const raw = events.map((event) => event.raw).join('\n\n');

  if (!raw) {
    return <EmptySectionLabel label="No raw events yet" />;
  }

  return (
    <pre
      className="m-0 max-h-full overflow-auto whitespace-pre-wrap break-words font-mono text-[14px] text-text"
      aria-label="Raw SSE stream"
    >
      {raw}
    </pre>
  );
}
