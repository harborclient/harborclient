import {
  useEffect,
  useId,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  buildCodePreview,
  CODE_PREVIEW_TOOLTIP_SETTLE_MS
} from '#/renderer/src/ui/shared/CodePreview/codePreview';

interface Props {
  /**
   * JavaScript source shown in the preview and tooltip.
   */
  code: string;

  /**
   * Accessible name for the clickable preview action.
   */
  actionLabel: string;

  /**
   * Called when the preview is clicked or activated with the keyboard.
   */
  onClick: () => void;

  /**
   * Label shown when {@link code} is empty; omit to render nothing instead.
   */
  emptyLabel?: string;

  /**
   * When true, omits the preview from the layout (e.g. while a script row is expanded).
   */
  hidden?: boolean;

  /**
   * Optional pointer handler for nested controls inside draggable rows.
   */
  onPointerDown?: (event: ReactPointerEvent) => void;
}

/**
 * First-line code preview with a settled-hover tooltip for additional source lines.
 */
export function CodePreviewTooltip({
  code,
  actionLabel,
  onClick,
  emptyLabel,
  hidden = false,
  onPointerDown
}: Props): JSX.Element | null {
  const preview = buildCodePreview(code);
  const tooltipId = useId();
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const tooltipOpen = hoverOpen || focusOpen;

  /**
   * Clears any pending hover-settle timer.
   */
  const clearSettleTimer = (): void => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  };

  /**
   * Starts or resets the hover-settle timer before opening the tooltip.
   */
  const scheduleHoverOpen = (): void => {
    clearSettleTimer();
    settleTimerRef.current = setTimeout(() => {
      setHoverOpen(true);
      settleTimerRef.current = null;
    }, CODE_PREVIEW_TOOLTIP_SETTLE_MS);
  };

  /**
   * Clears pending hover timers when the preview unmounts.
   */
  useEffect(() => {
    return () => {
      clearSettleTimer();
    };
  }, []);

  if (hidden) {
    return null;
  }

  if (!preview) {
    if (!emptyLabel) {
      return null;
    }

    return (
      <div className="relative min-w-0">
        <button
          type="button"
          className="w-full cursor-pointer truncate rounded-sm border-none bg-transparent p-0 text-left text-[14px] text-muted outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={actionLabel}
          onClick={onClick}
          onPointerDown={onPointerDown}
        >
          {emptyLabel}
        </button>
      </div>
    );
  }

  const hasTooltip = Boolean(preview.tooltipLines.trim());

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        className="w-full cursor-pointer truncate rounded-sm border-none bg-transparent p-0 text-left font-mono text-[14px] italic text-muted/50 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent app-no-drag"
        aria-label={`${actionLabel}. ${preview.firstLine}`}
        aria-describedby={hasTooltip && tooltipOpen ? tooltipId : undefined}
        tabIndex={0}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onMouseEnter={() => {
          if (hasTooltip) {
            scheduleHoverOpen();
          }
        }}
        onMouseMove={() => {
          if (hasTooltip && !hoverOpen) {
            scheduleHoverOpen();
          }
        }}
        onMouseLeave={() => {
          clearSettleTimer();
          setHoverOpen(false);
        }}
        onFocus={() => {
          if (hasTooltip) {
            setFocusOpen(true);
          }
        }}
        onBlur={() => {
          setFocusOpen(false);
        }}
      >
        {preview.firstLine}
      </button>
      {hasTooltip ? (
        <div
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute left-0 top-full z-30 mt-1 min-w-[280px] max-w-lg rounded-md border border-separator bg-surface p-3 shadow-md transition-opacity motion-reduce:transition-none ${
            tooltipOpen ? 'visible opacity-100' : 'invisible opacity-0'
          }`}
        >
          <pre className="m-0 whitespace-pre-wrap font-mono text-[14px] italic text-muted/50">
            {preview.tooltipLines}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
