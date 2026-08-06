import { useMemo, useState, type JSX } from 'react';
import type { SseEvent } from '@harborclient/core/types';
import {
  Button,
  CodeEditor,
  FaIcon,
  Modal,
  ModalFooter,
  SegmentedTabPanel,
  SegmentedTabs,
  SegmentedTabsGroup,
  portalToBody
} from '@harborclient/sdk/components';
import { faCompress, faExpand } from '#/renderer/src/fontawesome';
import { SseEventDetailNav, type SseEventDiffMode } from './SseEventDetailNav';
import { SseEventPayloadDiff } from './SseEventPayloadDiff';
import { formatEventPayload } from './sseEventPayload';

/**
 * Payload view tabs inside the SSE event detail modal.
 */
type PayloadTab = 'data' | 'raw';

/**
 * Default (collapsed) modal size classes.
 */
const MODAL_SIZE_COLLAPSED = 'h-[min(85vh,48rem)] w-[82rem] max-w-[90vw]';

/**
 * Expanded modal size: 90vh square, capped to viewport width on narrow screens.
 */
const MODAL_SIZE_EXPANDED = 'h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw]';

interface Props {
  /**
   * Selected SSE event to display in full.
   */
  event: SseEvent;

  /**
   * Previous filtered event for Diff comparison, when any.
   */
  previousEvent: SseEvent | null;

  /**
   * Next filtered event for Diff comparison, when any.
   */
  nextEvent: SseEvent | null;

  /**
   * Bumps when the user picks an event from the table so Diff mode can reset
   * without clearing Diff during Previous/Next navigation.
   */
  selectionRevision: number;

  /**
   * Whether a previous filtered event exists.
   */
  canGoPrevious: boolean;

  /**
   * Whether a next filtered event exists.
   */
  canGoNext: boolean;

  /**
   * Selects the previous filtered event.
   */
  onPrevious: () => void;

  /**
   * Selects the next filtered event.
   */
  onNext: () => void;

  /**
   * Closes the detail modal.
   */
  onClose: () => void;
}

/**
 * Modal showing metadata and payloads for a single selected SSE event.
 *
 * Supports optional side-by-side Data Diff against the previous or next
 * filtered neighbor. Previous/Next navigate and exit Diff; Previous Diff/Next
 * Diff enter Diff or step while keeping it open. Exit Diff and table-row
 * selection also return to the single-pane Data view. A header expand control
 * toggles a 90vh modal so the Data/Diff editors can fill the space.
 *
 * @param props - Selected event, neighbors, revision, and navigation handlers.
 * @returns Blocking dialog with event details and optional Data Diff.
 */
export function SseEventDetail({
  event,
  previousEvent,
  nextEvent,
  selectionRevision,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onClose
}: Props): JSX.Element {
  const titleId = 'sse-event-detail-title';
  const dataEditorId = `sse-event-detail-data-${event.seq}`;
  const [payloadTab, setPayloadTab] = useState<PayloadTab>('data');
  const [diffMode, setDiffMode] = useState<SseEventDiffMode>('none');
  const [expanded, setExpanded] = useState(false);
  const [seenSelectionRevision, setSeenSelectionRevision] = useState(selectionRevision);

  /**
   * Adjusts Diff mode during render when props change: table-row selection
   * bumps `selectionRevision`, and missing neighbors clear an active Diff.
   * (React-recommended alternative to syncing in an effect.)
   */
  if (selectionRevision !== seenSelectionRevision) {
    setSeenSelectionRevision(selectionRevision);
    setDiffMode('none');
  } else if (diffMode === 'previous' && previousEvent == null) {
    setDiffMode('none');
  } else if (diffMode === 'next' && nextEvent == null) {
    setDiffMode('none');
  }

  /**
   * Pretty-printed data payload for the selected event.
   */
  const formattedData = useMemo(() => formatEventPayload(event.data), [event.data]);

  /**
   * Pretty-printed payload for the previous filtered neighbor.
   */
  const formattedPrevious = useMemo(
    () => (previousEvent != null ? formatEventPayload(previousEvent.data) : null),
    [previousEvent]
  );

  /**
   * Pretty-printed payload for the next filtered neighbor.
   */
  const formattedNext = useMemo(
    () => (nextEvent != null ? formatEventPayload(nextEvent.data) : null),
    [nextEvent]
  );

  /**
   * Navigates to the previous filtered event and exits Diff mode.
   */
  const handlePrevious = (): void => {
    setDiffMode('none');
    onPrevious();
  };

  /**
   * Navigates to the next filtered event and exits Diff mode.
   */
  const handleNext = (): void => {
    setDiffMode('none');
    onNext();
  };

  /**
   * Enters previous-neighbor Diff, switches from next Diff, or steps to the
   * previous event while keeping previous Diff open.
   */
  const handlePreviousDiff = (): void => {
    setPayloadTab('data');
    if (diffMode === 'previous') {
      onPrevious();
      return;
    }
    setDiffMode('previous');
  };

  /**
   * Enters next-neighbor Diff, switches from previous Diff, or steps to the
   * next event while keeping next Diff open.
   */
  const handleNextDiff = (): void => {
    setPayloadTab('data');
    if (diffMode === 'next') {
      onNext();
      return;
    }
    setDiffMode('next');
  };

  /**
   * Returns to the single-pane Data view without closing the modal.
   */
  const handleExitDiff = (): void => {
    setDiffMode('none');
  };

  /**
   * Toggles between the default modal size and the 90vh expanded size.
   */
  const handleToggleExpanded = (): void => {
    setExpanded((current) => !current);
  };

  /**
   * Whether the Data tab is showing a Diff instead of a single payload pane.
   */
  const showingDiff =
    (diffMode === 'previous' && previousEvent != null && formattedPrevious != null) ||
    (diffMode === 'next' && nextEvent != null && formattedNext != null);

  /**
   * Syntax mode for Diff panes: JSON only when both compared payloads parsed.
   */
  const diffLanguage = useMemo(() => {
    if (diffMode === 'previous' && formattedPrevious != null) {
      return formattedPrevious.isJson && formattedData.isJson ? 'json' : 'text';
    }
    if (diffMode === 'next' && formattedNext != null) {
      return formattedData.isJson && formattedNext.isJson ? 'json' : 'text';
    }
    return 'text' as const;
  }, [diffMode, formattedData.isJson, formattedNext, formattedPrevious]);

  const expandLabel = expanded ? 'Collapse event detail modal' : 'Expand event detail modal';

  return portalToBody(
    <Modal
      className={expanded ? MODAL_SIZE_EXPANDED : MODAL_SIZE_COLLAPSED}
      overlayClassName="z-[70]"
      labelledBy={titleId}
      onClose={onClose}
      title={`Event ${event.seq}`}
      description={`${event.type}${event.id != null ? ` · id ${event.id}` : ''}`}
      headerActions={
        <Button
          type="button"
          variant="icon"
          aria-label={expandLabel}
          aria-pressed={expanded}
          onClick={handleToggleExpanded}
        >
          <FaIcon icon={expanded ? faCompress : faExpand} className="h-4 w-4" />
        </Button>
      }
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <dl className="m-0 grid min-w-0 flex-1 grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">Seq</dt>
            <dd className="m-0 font-mono">{event.seq}</dd>
            <dt className="text-muted">Type</dt>
            <dd className="m-0 font-mono">{event.type}</dd>
            <dt className="text-muted">Id</dt>
            <dd className="m-0 font-mono">{event.id ?? '—'}</dd>
            <dt className="text-muted">Received</dt>
            <dd className="m-0 font-mono">{new Date(event.receivedAt).toLocaleString()}</dd>
            {event.retryMs != null ? (
              <>
                <dt className="text-muted">Retry</dt>
                <dd className="m-0 font-mono">{event.retryMs} ms</dd>
              </>
            ) : null}
          </dl>
          <SseEventDetailNav
            diffMode={diffMode}
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onPreviousDiff={handlePreviousDiff}
            onNextDiff={handleNextDiff}
          />
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <SegmentedTabsGroup
            value={payloadTab}
            onChange={setPayloadTab}
            ariaLabel="SSE event payload view"
          >
            <div className="shrink-0">
              <SegmentedTabs
                pattern="radiogroup"
                editable={false}
                tabs={[
                  {
                    value: 'data',
                    label: formattedData.isJson ? 'Data (JSON)' : 'Data'
                  },
                  { value: 'raw', label: 'Raw' }
                ]}
              />
            </div>
            <SegmentedTabPanel value="data" className="mt-3 flex min-h-0 flex-1 flex-col">
              {showingDiff &&
              diffMode === 'previous' &&
              previousEvent != null &&
              formattedPrevious != null ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <SseEventPayloadDiff
                    leftEvent={previousEvent}
                    rightEvent={event}
                    leftText={formattedPrevious.text}
                    rightText={formattedData.text}
                    language={diffLanguage}
                  />
                </div>
              ) : showingDiff &&
                diffMode === 'next' &&
                nextEvent != null &&
                formattedNext != null ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <SseEventPayloadDiff
                    leftEvent={event}
                    rightEvent={nextEvent}
                    leftText={formattedData.text}
                    rightText={formattedNext.text}
                    language={diffLanguage}
                  />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-separator bg-field">
                  {formattedData.isJson ? (
                    <CodeEditor
                      key={dataEditorId}
                      id={dataEditorId}
                      value={formattedData.text}
                      language="json"
                      readOnly
                      minHeight="100%"
                      height="100%"
                      aria-label="SSE event data JSON"
                    />
                  ) : (
                    <pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-[14px]">
                      {formattedData.text}
                    </pre>
                  )}
                </div>
              )}
            </SegmentedTabPanel>
            <SegmentedTabPanel value="raw" className="mt-3 flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-separator bg-field">
                <pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-[14px]">
                  {event.raw}
                </pre>
              </div>
            </SegmentedTabPanel>
          </SegmentedTabsGroup>
        </div>

        <ModalFooter spaced className={`shrink-0 ${diffMode !== 'none' ? 'justify-between' : ''}`}>
          {diffMode !== 'none' ? (
            <Button
              type="button"
              variant="secondary"
              aria-label="Exit Diff view and return to single event data"
              onClick={handleExitDiff}
            >
              Exit Diff
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
