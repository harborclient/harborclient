import { Resizable, EmptyState } from '@harborclient/sdk/components';
import { type JSX } from 'react';

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
          <span className="text-[16px] font-medium text-text">Variables in this request</span>
          <span className="truncate text-[16px] text-muted">{contextLine}</span>
        </div>
      }
    >
      <div className="min-h-0 flex-1 overflow-auto">
        {variables.length === 0 ? (
          <EmptyState variant="centered" className="h-full">
            No variables in scope. Add variables in Settings → Globals, or to the active collection
            or environment.
          </EmptyState>
        ) : (
          <table className="w-full border-collapse text-[16px]">
            <caption className="sr-only">Variables in scope for this request</caption>
            <colgroup>
              <col />
              <col className="w-full" />
              <col />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-separator bg-sidebar/40 text-left">
                <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-text">
                  Variable
                </th>
                <th scope="col" className="px-3 py-2 font-medium text-text">
                  Value
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 text-right font-medium text-text"
                >
                  Scope
                </th>
              </tr>
            </thead>
            <tbody>
              {variables.map((variable) => (
                <VariableRow key={`${variable.scope}-${variable.key}`} variable={variable} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Resizable>
  );
}
