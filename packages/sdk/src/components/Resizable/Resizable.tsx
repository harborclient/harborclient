import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useCallback, useRef } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { RoundButton } from '../RoundButton/index.js';
import { cn } from '../utils.js';
import { ResizeHandle } from './ResizeHandle.js';
import {
  DEFAULT_HEIGHT,
  MIN_HEIGHT,
  footerPanelClassName,
  getFooterPanelMaxSize
} from './footerPanelUtils';
import { useResizable } from './useResizable.js';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'id' | 'title'> {
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
   * Whether or not to show the close button.
   */
  showCloseButton?: boolean;

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
  showCloseButton = true,
  children,
  className,
  ...props
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
    <RoundButton
      icon={faXmark}
      ariaLabel={`Close ${closeLabel}`}
      onClick={onClose}
      className="hc-resizable-close"
    />
  );

  const body = unmountWhenClosed && !open ? null : children;

  return (
    <div
      ref={containerRef}
      {...props}
      id={id}
      className={cn('hc-resizable', footerPanelClassName(open), className)}
      style={{ height }}
      role="region"
      aria-label={`${closeLabel} panel`}
      aria-hidden={!open}
      inert={!open || undefined}
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
        <div className="hc-resizable-headerless relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {showCloseButton && (
            <RoundButton
              icon={faXmark}
              ariaLabel={`Close ${closeLabel}`}
              onClick={onClose}
              className="hc-resizable-headerless-close absolute top-2 right-2 z-10"
            />
          )}
          <div className="hc-resizable-body flex min-h-0 flex-1 flex-col">{body}</div>
        </div>
      ) : (
        <>
          <div className="hc-resizable-header flex shrink-0 items-center justify-between border-b border-separator px-3 py-2">
            <div className="hc-resizable-header-title min-w-0 flex-1">{title}</div>
            {showCloseButton && closeButton}
          </div>
          {body}
        </>
      )}
    </div>
  );
}
