import { Button } from '@harborclient/sdk/components';
import type { RequestHistoryEntry } from '@harborclient/core/types/requestHistory';
import type { SendResult } from '@harborclient/http';
import { useCallback, useMemo, useState, type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectRequestHistory } from '#/renderer/src/store/slices/requestHistorySlice';
import { isBinaryResponse, isImageResponse } from '#/renderer/src/ui/Shared/responseFormatUtils';
import { ResponseHistoryDiffPickerModal } from './ResponseHistoryDiffPickerModal';
import {
  canDiffResponse,
  priorResponseHistoryForDiff,
  type ResponseDiffKind,
  type ResponseHistoryMatchTarget
} from './responseHistoryDiff';

interface Props {
  /**
   * Whether the Diff targets the response body or headers.
   */
  kind: ResponseDiffKind;

  /**
   * Current response shown in the viewer.
   */
  response: SendResult;

  /**
   * Active request identity used to match prior history entries.
   */
  matchTarget: ResponseHistoryMatchTarget;

  /**
   * Whether an inline Diff baseline is currently active on the page.
   */
  diffActive: boolean;

  /**
   * Called when the user chooses a prior history entry as the Diff baseline.
   *
   * @param entry - Selected prior history entry.
   */
  onDiffBaselineSelected: (entry: RequestHistoryEntry) => void;

  /**
   * Clears the active inline Diff and restores the normal viewer content.
   */
  onCloseDiff: () => void;
}

/**
 * Diff page-header action that opens a history picker, then activates an inline Diff.
 */
export function ResponseViewerDiffActions({
  kind,
  response,
  matchTarget,
  diffActive,
  onDiffBaselineSelected,
  onCloseDiff
}: Props): JSX.Element {
  const history = useAppSelector(selectRequestHistory);
  const [pickerOpen, setPickerOpen] = useState(false);

  /**
   * Prior history entries eligible for Diff against the current response.
   */
  const priorEntries = useMemo(
    () => priorResponseHistoryForDiff(history, matchTarget, kind),
    [history, kind, matchTarget]
  );

  const diffEnabled = canDiffResponse(response, priorEntries);

  /**
   * Opens the history picker when Diff is available, or closes an active Diff.
   */
  const handlePrimaryClick = useCallback((): void => {
    if (diffActive) {
      onCloseDiff();
      return;
    }
    if (!diffEnabled) {
      return;
    }
    setPickerOpen(true);
  }, [diffActive, diffEnabled, onCloseDiff]);

  /**
   * Closes the history picker without opening a Diff.
   */
  const handleClosePicker = useCallback((): void => {
    setPickerOpen(false);
  }, []);

  /**
   * Activates the inline Diff for the chosen prior history entry.
   *
   * @param entry - Selected prior history entry.
   */
  const handleSelectEntry = useCallback(
    (entry: RequestHistoryEntry): void => {
      setPickerOpen(false);
      onDiffBaselineSelected(entry);
    },
    [onDiffBaselineSelected]
  );

  /**
   * Explains why Diff is disabled for assistive tech and the native tooltip.
   */
  const disabledReason = useMemo((): string | undefined => {
    if (diffActive) {
      return undefined;
    }
    if (isImageResponse(response.headers)) {
      return 'Diff is unavailable for image responses';
    }
    if (isBinaryResponse(response)) {
      return 'Diff is unavailable for binary responses';
    }
    if (priorEntries.length === 0) {
      return 'No previous request history to compare';
    }
    return undefined;
  }, [diffActive, priorEntries.length, response]);

  const buttonLabel = diffActive ? 'Close diff' : 'Diff';
  const ariaLabel = diffActive
    ? 'Close Diff and show the normal response view'
    : (disabledReason ?? `Diff ${kind} against previous response`);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={!diffActive && !diffEnabled}
        aria-disabled={!diffActive && !diffEnabled}
        aria-label={ariaLabel}
        title={disabledReason}
        onClick={handlePrimaryClick}
      >
        {buttonLabel}
      </Button>
      {pickerOpen ? (
        <ResponseHistoryDiffPickerModal
          entries={priorEntries}
          onClose={handleClosePicker}
          onSelect={handleSelectEntry}
        />
      ) : null}
    </>
  );
}
