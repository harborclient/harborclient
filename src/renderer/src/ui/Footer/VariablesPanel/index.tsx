import { useCallback, useRef, type JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import { faXmark } from '#/renderer/src/fontawesome';
import { DEFAULT_HEIGHT, MIN_HEIGHT } from './constants';
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
  const { size: height, onResizeStart } = useResizable({
    axis: 'y',
    direction: -1,
    defaultSize: DEFAULT_HEIGHT,
    minSize: MIN_HEIGHT,
    getMaxSize: () => {
      const shell = containerRef.current?.parentElement?.parentElement;
      const contentArea = shell?.children[1] as HTMLElement | undefined;
      if (!contentArea) return window.innerHeight * 0.8;
      return contentArea.clientHeight - 40;
    },
    storageKey: 'hc.variablesHeight'
  });

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const contextLine = [
    collectionName ?? 'No collection',
    environmentName ?? 'No environment'
  ].join(' · ');

  const panelClassName = [
    'absolute inset-x-0 bottom-full z-40 flex flex-col border-t border-separator bg-surface',
    'shadow-[0_-4px_16px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out app-no-drag',
    open ? 'translate-y-0' : 'translate-y-full pointer-events-none'
  ].join(' ');

  return (
    <div ref={containerRef} className={panelClassName} style={{ height }} aria-hidden={!open}>
      <ResizeHandle
        orientation="horizontal"
        onResizeStart={onResizeStart}
        ariaLabel="Resize variables panel"
      />

      <div className="flex shrink-0 items-center justify-between border-b border-separator px-3 py-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-medium text-text">Variables</span>
          <span className="truncate text-[11px] text-muted">{contextLine}</span>
        </div>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[14px] text-muted hover:bg-selection hover:text-text app-no-drag"
          onClick={handleClose}
          aria-label="Close variables"
        >
          <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {variables.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-[13px] text-muted">
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
