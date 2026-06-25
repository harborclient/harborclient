import { useCallback, useRef, type JSX } from 'react';
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
import type { ResolvedVariable } from './resolve';
import { VariableRow } from './VariableRow';

interface Props {
  /**
   * Resolved variables with scope and override info.
   */
  variables: ResolvedVariable[];

  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the variables panel.
   */
  onClose: () => void;

  /**
   * Name of the active collection, if any.
   */
  collectionName?: string;

  /**
   * Name of the active environment, if any.
   */
  environmentName?: string;
}

/**
 * Slide-up, resizable panel showing variables in scope for the active request.
 */
export function VariablesPanel({
  variables,
  open,
  onClose,
  collectionName,
  environmentName
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
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
    getMaxSize: () => getFooterPanelMaxSize(containerRef),
    storageKey: 'hc.variablesHeight'
  });

  /**
   * Closes the variables panel.
   */
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const contextLine = [collectionName ?? 'No collection', environmentName ?? 'No environment'].join(
    ' · '
  );

  return (
    <div
      ref={containerRef}
      id="footer-variables-panel"
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
        ariaLabel="Resize variables panel"
      />

      <div className="flex shrink-0 items-center justify-between border-b border-separator px-3 py-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-medium text-text">Variables</span>
          <span className="truncate text-[14px] text-muted">{contextLine}</span>
        </div>
        <button
          type="button"
          className={footerPanelCloseButtonClassName}
          onClick={handleClose}
          aria-label="Close variables"
        >
          <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {variables.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-[14px] text-muted">
            No variables in scope. Add variables to the active collection or environment.
          </div>
        ) : (
          variables.map((variable) => (
            <VariableRow key={`${variable.scope}-${variable.key}`} variable={variable} />
          ))
        )}
      </div>
    </div>
  );
}
