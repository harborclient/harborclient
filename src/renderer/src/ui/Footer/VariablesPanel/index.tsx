import { FooterPanel, EmptyState } from '@harborclient/sdk/components';
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
   * Name of the active folder, if any.
   */
  folderName?: string;

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
  folderName,
  environmentName
}: Props): JSX.Element {
  const contextParts = [
    collectionName ?? 'No collection',
    folderName ?? 'No folder',
    environmentName ?? 'No environment'
  ];
  const contextLine = contextParts.join(' · ');

  return (
    <FooterPanel
      id="footer-variables-panel"
      open={open}
      onClose={onClose}
      closeLabel="variables"
      storageKey="hc.variablesHeight"
      title="Variables in this request"
      description={contextLine}
    >
      {variables.length === 0 ? (
        <EmptyState variant="centered" className="h-full">
          No variables in scope. Add variables in Settings → Globals, or to the active collection,
          folder, or environment.
        </EmptyState>
      ) : (
        <table className="w-full border-collapse">
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
    </FooterPanel>
  );
}
