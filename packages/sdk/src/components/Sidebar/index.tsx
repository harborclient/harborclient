import { type JSX, type ReactNode } from 'react';
import { ResizeHandle, type UseResizableOptions, useResizable } from '../Resizable/index.js';
import { Scrollbars } from '../Scrollbars/index.js';
import { cn } from '../utils.js';

/**
 * Which edge of the main content the sidebar attaches to.
 */
export type SidebarSide = 'left' | 'right';

interface Props {
  /**
   * Which edge of the main content the sidebar attaches to.
   */
  side: SidebarSide;

  /**
   * Accessible label for the sidebar landmark.
   */
  ariaLabel: string;

  /**
   * Non-scrolling chrome rendered above the body (search, toolbar, title bar, etc.).
   */
  header?: ReactNode;

  /**
   * Sidebar body content.
   */
  children: ReactNode;

  /**
   * When true (default), wraps the body in a scrollable region.
   */
  scroll?: boolean;

  /**
   * Scroll axis when `scroll` is enabled.
   */
  scrollAxis?: 'vertical' | 'horizontal' | 'both';

  /**
   * When true, scrollbars fade after scrolling stops.
   */
  scrollbarAutoHide?: boolean;

  /**
   * Additional classes for the scrollable body content (padding, etc.).
   * Applied to the inner content wrapper — not the OverlayScrollbars host —
   * so section-header negative margins can cancel body padding and keep
   * header actions aligned with row hamburgers.
   */
  bodyClassName?: string;

  /**
   * Optional id for the body wrapper (e.g. rail `aria-controls` target).
   */
  bodyId?: string;

  /**
   * Optional ARIA role for the body wrapper (e.g. `tabpanel` with a rail tablist).
   */
  bodyRole?: string;

  /**
   * Additional classes for the resizable aside element.
   */
  asideClassName?: string;

  /**
   * Additional classes for the resize handle.
   */
  resizeHandleClassName?: string;

  /**
   * Accessible label for the resize handle.
   */
  resizeAriaLabel?: string;

  /**
   * Initial width when nothing is persisted.
   */
  defaultSize: number;

  /**
   * Minimum sidebar width in pixels.
   */
  minSize: number;

  /**
   * Optional dynamic maximum width in pixels.
   */
  getMaxSize?: () => number;

  /**
   * localStorage key used to persist sidebar width.
   */
  storageKey: string;
}

/**
 * Resizable sidebar shell with side-aware handle placement and optional scrolling body.
 *
 * Left sidebars render `[aside][handle]`; right sidebars render `[handle][aside]`.
 */
export function Sidebar({
  side,
  ariaLabel,
  header,
  children,
  scroll = true,
  scrollAxis = 'vertical',
  scrollbarAutoHide = true,
  bodyClassName,
  bodyId,
  bodyRole,
  asideClassName,
  resizeHandleClassName,
  resizeAriaLabel,
  defaultSize,
  minSize,
  getMaxSize,
  storageKey
}: Props): JSX.Element {
  const resizableOptions: UseResizableOptions = {
    axis: 'x',
    direction: side === 'left' ? 1 : -1,
    defaultSize,
    minSize,
    getMaxSize,
    storageKey
  };

  const {
    size: width,
    minSize: sidebarMinSize,
    maxSize: sidebarMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable(resizableOptions);

  const handle = (
    <ResizeHandle
      orientation="vertical"
      value={width}
      min={sidebarMinSize}
      max={sidebarMaxSize}
      onResizeStart={onResizeStart}
      onKeyboardResize={onKeyboardResize}
      ariaLabel={resizeAriaLabel ?? 'Resize sidebar'}
      className={cn(
        side === 'right' && 'border-r-0 border-l border-resize-separator',
        resizeHandleClassName
      )}
    />
  );

  /**
   * Stretch wrapper so short body content (e.g. centered empty states) fills the
   * scroll viewport height while still allowing overflow scroll when content grows.
   * Body padding lives here (not on the Scrollbars host) so OverlayScrollbars
   * does not absorb it and section-header `-mr-*` cancel math keeps working.
   */
  const scrollBody = (
    <div className={cn('flex min-h-full min-w-0 flex-col', bodyClassName)}>{children}</div>
  );

  const body = scroll ? (
    <Scrollbars
      id={bodyId}
      role={bodyRole}
      axis={scrollAxis}
      autoHide={scrollbarAutoHide}
      className="min-h-0 flex-1"
    >
      {scrollBody}
    </Scrollbars>
  ) : (
    <div id={bodyId} role={bodyRole} className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>
      {children}
    </div>
  );

  const aside = (
    <aside
      className={cn(
        'hc-sidebar flex shrink-0 flex-col overflow-x-hidden bg-sidebar',
        side === 'right' && 'h-full min-h-0',
        asideClassName
      )}
      style={{ width }}
      aria-label={ariaLabel}
    >
      {header}
      {body}
    </aside>
  );

  if (side === 'left') {
    return (
      <>
        {aside}
        {handle}
      </>
    );
  }

  return (
    <>
      {handle}
      {aside}
    </>
  );
}
