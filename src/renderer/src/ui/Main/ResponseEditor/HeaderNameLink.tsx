import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX
} from 'react';
import { CODE_PREVIEW_TOOLTIP_SETTLE_MS } from '#/renderer/src/ui/shared/CodePreview/codePreview';
import {
  buildFixedTooltipPosition,
  findScrollParent,
  getTooltipContainerBounds,
  resolveTooltipPlacement
} from '#/renderer/src/ui/shared/tooltipPlacement';

import { headerMdnDocsUrl } from './headerMdnDocs';
import { getHttpHeaderDescription, UNKNOWN_HEADER_DESCRIPTION } from './httpHeaderDescriptions';

interface Props {
  /**
   * HTTP header field name shown as the link label.
   */
  headerName: string;
}

/**
 * Response header name linked to MDN with a hover and focus description tooltip.
 */
export function HeaderNameLink({ headerName }: Props): JSX.Element {
  const tooltipId = useId();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
  const tooltipOpen = hoverOpen || focusOpen;
  const description = getHttpHeaderDescription(headerName);
  const isFallback = description === UNKNOWN_HEADER_DESCRIPTION;

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
   * Measures anchor and container bounds to place the tooltip above or below.
   */
  const updateTooltipPosition = useCallback((): void => {
    const anchor = linkRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const scrollParent = findScrollParent(anchor);
    const containerBounds = getTooltipContainerBounds(scrollParent);
    const nextPlacement = resolveTooltipPlacement(
      anchorRect,
      tooltip.offsetHeight,
      containerBounds
    );
    const { left, top } = buildFixedTooltipPosition(anchorRect, nextPlacement);

    setTooltipStyle({
      left,
      top,
      transform: nextPlacement === 'above' ? 'translateY(-100%)' : undefined
    });
  }, []);

  /**
   * Clears pending hover timers when the link unmounts.
   */
  useEffect(() => {
    return () => {
      clearSettleTimer();
    };
  }, []);

  /**
   * Recomputes tooltip placement when it opens and while the user scrolls or resizes.
   */
  useLayoutEffect(() => {
    if (!tooltipOpen) {
      return;
    }

    updateTooltipPosition();

    const anchor = linkRef.current;
    if (!anchor) {
      return;
    }

    const scrollParent = findScrollParent(anchor);
    scrollParent?.addEventListener('scroll', updateTooltipPosition, { passive: true });
    window.addEventListener('resize', updateTooltipPosition);

    return () => {
      scrollParent?.removeEventListener('scroll', updateTooltipPosition);
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [tooltipOpen, description, updateTooltipPosition]);

  return (
    <div className="min-w-0">
      <a
        ref={linkRef}
        href={headerMdnDocsUrl(headerName)}
        target="_blank"
        rel="noreferrer"
        className="break-words text-[14px] font-medium text-accent hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        aria-label={`${headerName} header documentation on MDN`}
        aria-describedby={tooltipOpen ? tooltipId : undefined}
        onMouseEnter={scheduleHoverOpen}
        onMouseMove={() => {
          if (!hoverOpen) {
            scheduleHoverOpen();
          }
        }}
        onMouseLeave={() => {
          clearSettleTimer();
          setHoverOpen(false);
        }}
        onFocus={() => {
          setFocusOpen(true);
        }}
        onBlur={() => {
          setFocusOpen(false);
        }}
      >
        {headerName}
      </a>
      <div
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        style={tooltipStyle}
        className={`pointer-events-none fixed z-50 max-w-sm rounded-md border border-separator bg-surface p-2.5 shadow-md transition-opacity motion-reduce:transition-none ${
          isFallback ? 'text-muted' : 'text-text'
        } ${tooltipOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
      >
        {description}
      </div>
    </div>
  );
}
