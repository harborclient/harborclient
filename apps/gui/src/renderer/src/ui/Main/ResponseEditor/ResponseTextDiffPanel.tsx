import type { RequestHistoryEntry } from '@harborclient/core/types/requestHistory';
import type { CodeEditorLanguage } from '@harborclient/sdk/components';
import { useMemo, type JSX } from 'react';
import { normalizeRequestHistoryEntry } from '#/renderer/src/store/thunks/requestHistory';
import { formatSidebarAbsoluteDate } from '#/renderer/src/ui/Sidebars/CollectionSidebar/History/utils';
import { TextDiffSplitView } from '#/renderer/src/ui/Shared/TextDiffSplitView';

interface Props {
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

  /**
   * History entry chosen as the Diff baseline.
   */
  baselineEntry: RequestHistoryEntry;
}

/**
 * Builds a short subtitle describing the Diff baseline entry.
 *
 * @param entry - Selected prior history entry.
 * @returns Human-readable baseline label with absolute timestamp.
 */
function baselineSubtitle(entry: RequestHistoryEntry): string {
  const normalized = normalizeRequestHistoryEntry(entry);
  const name = normalized.name ?? entry.url;
  return `${name} · ${formatSidebarAbsoluteDate(entry.ts)}`;
}

/**
 * Inline full-page panel showing a side-by-side Diff of previous vs current response content.
 */
export function ResponseTextDiffPanel({
  title,
  previous,
  current,
  language,
  baselineEntry
}: Props): JSX.Element {
  /**
   * Stable baseline label for the previous-pane column header.
   */
  const baselineLabel = useMemo(() => baselineSubtitle(baselineEntry), [baselineEntry]);

  return (
    <div className="response-text-diff-panel flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 gap-2 text-[14px] text-muted">
        <div className="min-w-0">
          <div>Previous response</div>
          <div className="truncate" title={baselineLabel}>
            {baselineLabel}
          </div>
        </div>
        <div>Current response</div>
      </div>
      <TextDiffSplitView
        previous={previous}
        current={current}
        language={language}
        previousLabel="Previous response"
        currentLabel="Current response"
        ariaLabel={`${title}: previous versus current`}
      />
    </div>
  );
}
