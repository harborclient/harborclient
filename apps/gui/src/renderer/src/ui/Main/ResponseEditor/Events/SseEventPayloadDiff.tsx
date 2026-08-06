import type { SseEvent } from '@harborclient/core/types';
import type { CodeEditorLanguage } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { TextDiffSplitView } from '#/renderer/src/ui/Shared/TextDiffSplitView';

interface Props {
  /**
   * Left-pane event (neighbor or current, depending on Diff direction).
   */
  leftEvent: SseEvent;

  /**
   * Right-pane event (current or neighbor, depending on Diff direction).
   */
  rightEvent: SseEvent;

  /**
   * Formatted left-pane payload text.
   */
  leftText: string;

  /**
   * Formatted right-pane payload text.
   */
  rightText: string;

  /**
   * Syntax mode for both Diff panes.
   */
  language: CodeEditorLanguage;
}

/**
 * Builds a short column label for one SSE event in the Diff header.
 *
 * @param event - Event shown in the pane.
 * @returns Label like `Event 9 · echo`.
 */
function eventColumnLabel(event: SseEvent): string {
  return `Event ${event.seq} · ${event.type}`;
}

/**
 * Side-by-side SSE event Data Diff with column labels and a resizable divider.
 *
 * @param props - Left/right events, formatted texts, and language.
 * @returns Labeled Diff split view for the Data tab.
 */
export function SseEventPayloadDiff({
  leftEvent,
  rightEvent,
  leftText,
  rightText,
  language
}: Props): JSX.Element {
  const leftLabel = eventColumnLabel(leftEvent);
  const rightLabel = eventColumnLabel(rightEvent);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 gap-2 text-[14px] text-muted">
        <div className="min-w-0 truncate" title={leftLabel}>
          {leftLabel}
        </div>
        <div className="min-w-0 truncate" title={rightLabel}>
          {rightLabel}
        </div>
      </div>
      <TextDiffSplitView
        previous={leftText}
        current={rightText}
        language={language}
        previousLabel={leftLabel}
        currentLabel={rightLabel}
        ariaLabel={`SSE event Diff: ${leftLabel} versus ${rightLabel}`}
      />
    </div>
  );
}
