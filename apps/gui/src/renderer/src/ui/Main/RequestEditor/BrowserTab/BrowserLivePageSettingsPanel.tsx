import { ResizeHandle, useResizable } from '@harborclient/sdk/components';
import {
  useCallback,
  useRef,
  useState,
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type TransitionEvent
} from 'react';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { LivePageSettingsForm } from '#/renderer/src/ui/Tabs/LivePageSettings/LivePageSettingsForm';

/** Default open height for the live page settings panel. */
const DEFAULT_PANEL_HEIGHT = 280;

/** Minimum resizable panel height. */
const MIN_PANEL_HEIGHT = 160;

/** localStorage key for the panel height. */
const PANEL_HEIGHT_STORAGE_KEY = 'hc.livePageSettingsPanelHeight';

/** Space reserved below the panel so the guest stays usable. */
const GUEST_MIN_REMAINING_PX = 120;

interface Props {
  /**
   * When true, the panel expands to its resizable height; when false, height animates to 0.
   */
  open: boolean;

  /**
   * DOM id for aria-controls on the settings gear.
   */
  panelId: string;

  /**
   * Browser tab whose settings are shown in the panel.
   */
  browserTab: BrowserTab;

  /**
   * Closes the slide-down settings panel.
   */
  onClose: () => void;
}

/**
 * Returns whether the user prefers reduced motion.
 *
 * @returns True when OS requests minimized animation.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Slide-down, resizable live page settings panel anchored under browser chrome.
 *
 * Stays mounted so height can animate open/closed. Takes flex space so the guest
 * WebContentsView shrinks via bounds sync. Height persists in localStorage.
 *
 * @param props - Open state, panel id, linked browser tab, and close handler.
 * @returns Settings region hosting {@link LivePageSettingsForm}.
 */
export function BrowserLivePageSettingsPanel({
  open,
  panelId,
  browserTab,
  onClose
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  /**
   * Stays true through the close height animation so form content slides away with the panel.
   */
  const [holdContent, setHoldContent] = useState(open);

  if (open && !holdContent) {
    setHoldContent(true);
  } else if (!open && holdContent && prefersReducedMotion()) {
    setHoldContent(false);
  }

  /**
   * Caps panel height so a usable strip of the guest remains visible.
   */
  const getMaxSize = useCallback((): number => {
    const parent = containerRef.current?.parentElement;
    if (parent == null) {
      return window.innerHeight * 0.8;
    }
    return Math.max(MIN_PANEL_HEIGHT, parent.clientHeight - GUEST_MIN_REMAINING_PX);
  }, []);

  const {
    size,
    minSize,
    maxSize,
    onResizeStart: beginResize,
    onKeyboardResize
  } = useResizable({
    axis: 'y',
    direction: 1,
    defaultSize: DEFAULT_PANEL_HEIGHT,
    minSize: MIN_PANEL_HEIGHT,
    getMaxSize,
    storageKey: PANEL_HEIGHT_STORAGE_KEY
  });

  /**
   * Starts a drag resize and suppresses height transitions while dragging.
   *
   * @param event - Pointer down on the resize handle.
   */
  function handleResizeStart(event: ReactMouseEvent): void {
    setIsResizing(true);
    beginResize(event);

    /**
     * Clears the resizing flag when the shared drag ends.
     */
    function handleMouseUp(): void {
      setIsResizing(false);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Unmounts form content after the panel finishes collapsing closed.
   *
   * @param event - Height transition end on the panel root.
   */
  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>): void {
    if (event.propertyName !== 'height' || event.target !== event.currentTarget) {
      return;
    }
    if (!open) {
      setHoldContent(false);
    }
  }

  const showContent = open || holdContent;
  const height = open ? size : 0;

  return (
    <div
      ref={containerRef}
      id={panelId}
      role="region"
      aria-label="Live page settings"
      aria-hidden={!open}
      inert={!open || undefined}
      onTransitionEnd={handleTransitionEnd}
      className={[
        'flex shrink-0 flex-col overflow-hidden bg-surface app-no-drag',
        showContent ? 'border-b border-separator' : '',
        isResizing ? '' : 'transition-[height] duration-300 ease-out motion-reduce:transition-none'
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height }}
    >
      {showContent ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <LivePageSettingsForm
              key={browserTab.tabId}
              browserTab={browserTab}
              onClose={onClose}
            />
          </div>
          <ResizeHandle
            orientation="horizontal"
            value={size}
            min={minSize}
            max={maxSize}
            onResizeStart={handleResizeStart}
            onKeyboardResize={onKeyboardResize}
            ariaLabel="Resize live page settings panel"
            className={open ? undefined : 'pointer-events-none'}
          />
        </>
      ) : null}
    </div>
  );
}
