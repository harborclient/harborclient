import { Button } from '@harborclient/sdk/components';
import type { JSX, MouseEvent } from 'react';

/**
 * Side-by-side Data Diff mode inside the SSE event detail modal.
 */
export type SseEventDiffMode = 'none' | 'previous' | 'next';

interface Props {
  /**
   * Active Diff mode for the Data tab.
   */
  diffMode: SseEventDiffMode;

  /**
   * Whether a previous filtered event exists for navigation or Diff.
   */
  canGoPrevious: boolean;

  /**
   * Whether a next filtered event exists for navigation or Diff.
   */
  canGoNext: boolean;

  /**
   * Navigates to the previous filtered event and exits Diff mode.
   */
  onPrevious: () => void;

  /**
   * Navigates to the next filtered event and exits Diff mode.
   */
  onNext: () => void;

  /**
   * Enters previous-neighbor Diff, switches direction, or steps previous while
   * keeping previous Diff open.
   */
  onPreviousDiff: () => void;

  /**
   * Enters next-neighbor Diff, switches direction, or steps next while keeping
   * next Diff open.
   */
  onNextDiff: () => void;
}

/**
 * Runs a navigation action from a control without letting the click fall through
 * to the modal backdrop after layout updates.
 *
 * @param event - Mouse event from the control.
 * @param action - Navigation callback to invoke.
 */
function handleNavClick(event: MouseEvent<HTMLButtonElement>, action: () => void): void {
  event.preventDefault();
  event.stopPropagation();
  action();
}

/**
 * Five-control navigation toolbar for the SSE event detail modal.
 *
 * Layout: Previous Diff, Previous, separator, Next, Next Diff.
 *
 * @param props - Diff mode, availability flags, and navigation handlers.
 * @returns Grouped Previous/Next and Diff controls.
 */
export function SseEventDetailNav({
  diffMode,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onPreviousDiff,
  onNextDiff
}: Props): JSX.Element {
  return (
    <div
      className="flex shrink-0 items-center gap-2"
      role="group"
      aria-label="SSE event navigation"
    >
      <Button
        type="button"
        variant="secondary"
        disabled={!canGoPrevious}
        aria-label="Compare with previous SSE event"
        aria-pressed={diffMode === 'previous'}
        onClick={(clickEvent) => handleNavClick(clickEvent, onPreviousDiff)}
      >
        Previous Diff
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={!canGoPrevious}
        aria-label="Show previous SSE event"
        onClick={(clickEvent) => handleNavClick(clickEvent, onPrevious)}
      >
        Previous
      </Button>
      <div className="h-5 w-px shrink-0 bg-separator" aria-hidden />
      <Button
        type="button"
        variant="secondary"
        disabled={!canGoNext}
        aria-label="Show next SSE event"
        onClick={(clickEvent) => handleNavClick(clickEvent, onNext)}
      >
        Next
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={!canGoNext}
        aria-label="Compare with next SSE event"
        aria-pressed={diffMode === 'next'}
        onClick={(clickEvent) => handleNavClick(clickEvent, onNextDiff)}
      >
        Next Diff
      </Button>
    </div>
  );
}
