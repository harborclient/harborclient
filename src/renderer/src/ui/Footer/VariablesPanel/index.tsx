import { type JSX } from 'react';
import { Resizable } from '#/renderer/src/components/Resizable';
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
  const contextLine = [collectionName ?? 'No collection', environmentName ?? 'No environment'].join(
    ' · '
  );

  return (
    <Resizable
      id="footer-variables-panel"
      open={open}
      onClose={onClose}
      closeLabel="variables"
      storageKey="hc.variablesHeight"
      title={
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-medium text-text">Variables</span>
          <span className="truncate text-[14px] text-muted">{contextLine}</span>
        </div>
      }
    >
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
    </Resizable>
  );
}
