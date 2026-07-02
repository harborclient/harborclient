import { contentEditableRef$, useCellValue } from '@mdxeditor/editor';
import { getVariableTooltipContent } from '@harborclient/sdk/variables';
import { useCallback, useEffect, useId, useRef, useState, type JSX } from 'react';

import {
  applyVariableHighlights,
  findVariableHighlightAtPoint,
  type VariableHighlightMatch
} from './applyVariableHighlights';
import { highlightOnEditVariable$, highlightVariables$ } from './variableHighlightPlugin';

interface TooltipState {
  key: string;
  top: number;
  left: number;
}

/**
 * Resolves the main rich-text contenteditable element inside the MDXEditor wrapper.
 *
 * @param wrapper - MDXEditor content wrapper ref target.
 * @returns Contenteditable element used for variable highlighting.
 */
function resolveContentEditableRoot(
  wrapper: HTMLDivElement | null | undefined
): HTMLElement | null {
  if (!wrapper) {
    return null;
  }

  const editable = wrapper.querySelector<HTMLElement>('[contenteditable="true"]');
  return editable ?? wrapper;
}

/**
 * Lexical composer child that highlights {{variable}} tokens and shows hover tooltips.
 */
export function VariableHighlightComposer(): JSX.Element | null {
  const variables = useCellValue(highlightVariables$);
  const onEditVariable = useCellValue(highlightOnEditVariable$);
  const contentEditableRef = useCellValue(contentEditableRef$);
  const matchesRef = useRef<VariableHighlightMatch[]>([]);
  const hideTimerRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipId = useId();

  /**
   * Clears any pending tooltip hide timer.
   */
  const cancelHide = useCallback((): void => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  /**
   * Hides the tooltip after a short grace period so the pointer can reach it.
   */
  const scheduleHide = useCallback((): void => {
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => setTooltip(null), 400);
  }, [cancelHide]);

  /**
   * Refreshes CSS Custom Highlight ranges for variable tokens in the rich-text area.
   */
  const refreshHighlights = useCallback((): void => {
    const root = resolveContentEditableRoot(contentEditableRef?.current ?? null);
    matchesRef.current = applyVariableHighlights(root);
  }, [contentEditableRef]);

  /**
   * Observes rich-text DOM changes and refreshes variable highlight ranges.
   */
  useEffect(() => {
    const root = resolveContentEditableRoot(contentEditableRef?.current ?? null);
    if (!root) {
      return;
    }

    refreshHighlights();

    const observer = new MutationObserver(() => {
      queueMicrotask(refreshHighlights);
    });

    observer.observe(root, {
      characterData: true,
      childList: true,
      subtree: true
    });

    root.addEventListener('input', refreshHighlights);

    return () => {
      observer.disconnect();
      root.removeEventListener('input', refreshHighlights);
    };
  }, [contentEditableRef, variables, refreshHighlights]);

  /**
   * Tracks pointer hover over highlighted variable tokens in the rich-text editor.
   */
  useEffect(() => {
    const root = resolveContentEditableRoot(contentEditableRef?.current ?? null);
    if (!root) {
      return;
    }

    /**
     * Shows a tooltip when the pointer is over a highlighted {{variable}} token.
     *
     * @param event - Mouse move event from the contenteditable root.
     */
    const handleMouseMove = (event: MouseEvent): void => {
      cancelHide();
      const match = findVariableHighlightAtPoint(matchesRef.current, event.clientX, event.clientY);

      if (!match) {
        scheduleHide();
        return;
      }

      const rect = match.range.getBoundingClientRect();
      setTooltip({
        key: match.key,
        top: rect.top,
        left: rect.left + rect.width / 2
      });
    };

    root.addEventListener('mousemove', handleMouseMove);
    root.addEventListener('mouseleave', scheduleHide);

    return () => {
      root.removeEventListener('mousemove', handleMouseMove);
      root.removeEventListener('mouseleave', scheduleHide);
      cancelHide();
    };
  }, [contentEditableRef, cancelHide, scheduleHide]);

  /**
   * Clears pending tooltip timers when the composer unmounts.
   */
  useEffect(() => () => cancelHide(), [cancelHide]);

  const tooltipContent = tooltip ? getVariableTooltipContent(tooltip.key, variables) : null;

  if (!tooltip || !tooltipContent) {
    return null;
  }

  return (
    <div
      id={tooltipId}
      role="tooltip"
      className="pointer-events-auto fixed z-50 flex max-w-sm -translate-x-1/2 -translate-y-full flex-col gap-2 rounded-md border border-separator bg-surface px-4 py-3 text-[14px] text-text shadow-md after:pointer-events-auto after:absolute after:-bottom-2 after:left-0 after:right-0 after:h-2 after:content-[''] app-no-drag"
      style={{ top: tooltip.top - 4, left: tooltip.left }}
      onMouseEnter={cancelHide}
      onMouseLeave={scheduleHide}
    >
      <span className={tooltipContent.muted ? 'text-muted' : undefined}>{tooltipContent.text}</span>
      {onEditVariable && (
        <button
          type="button"
          className="-mx-1 self-start rounded px-1 py-0.5 text-[14px] text-accent hover:underline app-no-drag"
          aria-label={`Edit value for ${tooltip.key}`}
          onClick={() => {
            onEditVariable();
            setTooltip(null);
          }}
        >
          Edit value
        </button>
      )}
    </div>
  );
}
