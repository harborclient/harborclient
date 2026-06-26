import { useCallback, useRef, type JSX, type ReactNode } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faXmark } from '#/renderer/src/fontawesome';
import {
  DEFAULT_HEIGHT,
  MIN_HEIGHT,
  footerPanelClassName,
  footerPanelCloseButtonClassName,
  getFooterPanelMaxSize
} from './footerPanelUtils';
import { ResizeHandle } from './ResizeHandle';
import { useResizable } from './useResizable';

interface Props {
  /**
   * Root element id used by footer toggles via aria-controls.
   */
  id: string;

  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the panel.
   */
  onClose: () => void;

  /**
   * Plain-text name for close and resize aria labels (e.g. "console").
   */
  closeLabel: string;

  /**
   * localStorage key for persisted panel height.
   */
  storageKey: string;

  /**
   * Header content rendered in the title bar left side.
   */
  title?: ReactNode;

  /**
   * When true, skips the header bar and overlays the close button on content.
   */
  headerless?: boolean;

  /**
   * When true, does not render children while the panel is closed.
   */
  unmountWhenClosed?: boolean;

  /**
   * Panel body content.
   */
  children: ReactNode;
}

/**
 * Slide-up, resizable footer panel shell with optional header bar.
 *
 * Encapsulates resize handle wiring, height persistence, open/close animation,
 * and close affordance shared by Console, Variables, and plugin footer panels.
 */
export function Resizable({
  id,
  open,
  onClose,
  closeLabel,
  storageKey,
  title,
  headerless = false,
  unmountWhenClosed = false,
  children
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Keeps max-size measurement stable across re-renders so useResizable
   * does not re-run layout effects when unrelated UI updates.
   */
  const getMaxSize = useCallback(() => getFooterPanelMaxSize(containerRef), []);

  const {
    size: height,
    minSize: panelMinSize,
    maxSize: panelMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'y',
    direction: -1,
    defaultSize: DEFAULT_HEIGHT,
    minSize: MIN_HEIGHT,
    getMaxSize,
    storageKey
  });

  const closeButton = (
    <button
      type="button"
      className={footerPanelCloseButtonClassName}
      onClick={onClose}
      aria-label={`Close ${closeLabel}`}
    >
      <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
    </button>
  );

  const body = unmountWhenClosed && !open ? null : children;

  return (
    <div
      ref={containerRef}
      id={id}
      className={footerPanelClassName(open)}
      style={{ height }}
      aria-hidden={!open}
    >
      <ResizeHandle
        orientation="horizontal"
        value={height}
        min={panelMinSize}
        max={panelMaxSize}
        onResizeStart={onResizeStart}
        onKeyboardResize={onKeyboardResize}
        ariaLabel={`Resize ${closeLabel} panel`}
      />

      {headerless ? (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <button
            type="button"
            className={`absolute right-2 top-2 z-10 ${footerPanelCloseButtonClassName}`}
            onClick={onClose}
            aria-label={`Close ${closeLabel}`}
          >
            <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
          </button>
          <div className="flex min-h-0 flex-1 flex-col">{body}</div>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-separator px-3 py-2">
            <div className="min-w-0 flex-1">{title}</div>
            {closeButton}
          </div>
          {body}
        </>
      )}
    </div>
  );
}
