import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useId, useRef, useState } from '@harborclient/sdk/react';
import type {
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { portalToBody } from '../portalToBody.js';
import { cn } from '../utils.js';
import { getHelpTipPosition } from './helpTipPosition.js';

/** Delay before showing the tip after the pointer settles on the icon. */
export const HELP_TIP_SHOW_DELAY_MS = 1000;

/** Grace period before hiding after the pointer leaves the icon or tip. */
export const HELP_TIP_HIDE_DELAY_MS = 1000;

/** Estimated tip size used for the first placement before the panel is measured. */
const HELP_TIP_ESTIMATED_WIDTH_PX = 360;
const HELP_TIP_ESTIMATED_HEIGHT_PX = 140;

export interface Props {
  /**
   * Tip body shown in the floating panel. Prefer plain text so users can select
   * and copy help copy.
   */
  children: ReactNode;

  /**
   * Accessible name for the question-mark trigger button.
   */
  ariaLabel: string;

  /**
   * Extra classes on the inline trigger wrapper.
   */
  className?: string;
}

interface TipPosition {
  /** Left edge in viewport pixels. */
  x: number;

  /** Top edge in viewport pixels. */
  y: number;
}

/**
 * Compact question-mark control that opens a large, selectable help tip after a
 * short hover (or focus) settle delay. The tip opens above the icon when space
 * allows (otherwise below), stays open while the pointer is over the icon or
 * panel so users can select text, then dismisses after a hide delay when both
 * are left.
 */
export function HelpTip({ children, ariaLabel, className }: Props): JSX.Element {
  const tipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TipPosition | null>(null);

  /**
   * Clears any pending show timer.
   */
  const cancelShow = (): void => {
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  /**
   * Clears any pending hide timer.
   */
  const cancelHide = (): void => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  /**
   * Closes the tip and clears pending show/hide timers.
   */
  const dismissTip = (): void => {
    cancelShow();
    cancelHide();
    setOpen(false);
    setPosition(null);
  };

  /**
   * Resolves tip coordinates from the trigger rect, preferring above the icon.
   *
   * @param width - Tip width used for placement.
   * @param height - Tip height used for placement.
   * @returns Anchored tip position, or null when the trigger is unavailable.
   */
  const resolvePosition = (width: number, height: number): TipPosition | null => {
    if (triggerRef.current == null) {
      return null;
    }
    return getHelpTipPosition(triggerRef.current.getBoundingClientRect(), { width, height });
  };

  /**
   * Opens the tip above the trigger when possible, otherwise below it.
   */
  const openTip = (): void => {
    const next = resolvePosition(HELP_TIP_ESTIMATED_WIDTH_PX, HELP_TIP_ESTIMATED_HEIGHT_PX);
    if (next == null) {
      return;
    }
    setPosition(next);
    setOpen(true);
  };

  /**
   * Starts the settle delay before showing the tip.
   */
  const scheduleShow = (): void => {
    cancelHide();
    cancelShow();
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      openTip();
    }, HELP_TIP_SHOW_DELAY_MS);
  };

  /**
   * Starts the grace period before hiding so the pointer can reach the tip.
   */
  const scheduleHide = (): void => {
    cancelShow();
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setOpen(false);
      setPosition(null);
    }, HELP_TIP_HIDE_DELAY_MS);
  };

  /**
   * Prevents the trigger from activating an enclosing form label on click.
   *
   * @param event - Mouse event from the trigger.
   */
  const preventLabelActivation = (event: ReactMouseEvent): void => {
    event.preventDefault();
  };

  /**
   * Dismisses the tip immediately when Escape is pressed on the trigger.
   *
   * @param event - Keyboard event from the trigger.
   */
  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      dismissTip();
    }
  };

  /**
   * Repositions the tip from measured dimensions after mount so above/below
   * placement stays accurate when content size differs from the estimate.
   */
  useEffect(() => {
    if (!open || position == null || tipRef.current == null) {
      return;
    }

    const rect = tipRef.current.getBoundingClientRect();
    const next = resolvePosition(rect.width, rect.height);
    if (next != null && (next.x !== position.x || next.y !== position.y)) {
      setPosition(next);
    }
  }, [open, position, children]);

  /**
   * Dismisses the open tip on Escape from anywhere while it is visible.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    /**
     * Handles global Escape while the tip is open.
     *
     * @param event - Window keydown event.
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissTip();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /**
   * Clears pending timers when the component unmounts.
   */
  useEffect(() => {
    return () => {
      cancelShow();
      cancelHide();
    };
  }, []);

  return (
    <span className={cn('hc-help-tip inline-flex shrink-0 items-center', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="hc-help-tip-trigger inline-flex size-5 cursor-help items-center justify-center rounded-sm border-none bg-transparent p-0 text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={ariaLabel}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
        onFocus={scheduleShow}
        onBlur={scheduleHide}
        onMouseDown={preventLabelActivation}
        onClick={preventLabelActivation}
        onKeyDown={handleTriggerKeyDown}
      >
        <FaIcon icon={faCircleQuestion} className="hc-help-tip-icon h-3.5 w-3.5" />
      </button>
      {open && position != null
        ? portalToBody(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className="hc-help-tip-panel pointer-events-auto fixed z-[70] max-w-md rounded-lg border border-separator bg-surface px-3 py-3 leading-snug text-text shadow-md select-text before:pointer-events-auto before:absolute before:-top-2 before:right-0 before:left-0 before:h-2 before:content-[''] after:pointer-events-auto after:absolute after:right-0 after:-bottom-2 after:left-0 after:h-2 after:content-['']"
              style={{ top: position.y, left: position.x }}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              {children}
            </div>
          )
        : null}
    </span>
  );
}
