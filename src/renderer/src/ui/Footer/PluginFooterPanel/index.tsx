import { useCallback, useRef, type ComponentType, type JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import { faXmark } from '#/renderer/src/fontawesome';
import {
  DEFAULT_HEIGHT,
  MIN_HEIGHT,
  footerPanelClassName,
  footerPanelCloseButtonClassName,
  getFooterPanelMaxSize
} from '../panelUtils';

interface Props {
  /**
   * Namespaced panel id used for DOM ids and height persistence.
   */
  id: string;

  /**
   * Display title for the close button accessible name.
   */
  title: string;

  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the plugin footer panel.
   */
  onClose: () => void;

  /**
   * Plugin-provided panel content.
   */
  Component: ComponentType;
}

/**
 * Host-owned resizable shell for plugin footer panels.
 *
 * Wraps plugin content with the same resize handle, height persistence, and
 * close affordance as built-in Console and Variables panels.
 */
export function PluginFooterPanel({ id, title, open, onClose, Component }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Keeps max-size measurement stable across Footer re-renders so useResizable
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
    storageKey: `hc.footerPanel.${id}`
  });

  /**
   * Closes the plugin footer panel.
   */
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      id={`footer-plugin-panel-${id}`}
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
        ariaLabel={`Resize ${title} panel`}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          className={`absolute right-2 top-2 z-10 ${footerPanelCloseButtonClassName}`}
          onClick={handleClose}
          aria-label={`Close ${title}`}
        >
          <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
        </button>

        <div className="flex min-h-0 flex-1 flex-col">{open ? <Component /> : null}</div>
      </div>
    </div>
  );
}
