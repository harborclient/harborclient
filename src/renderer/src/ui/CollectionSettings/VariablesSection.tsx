import { VariableTable } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { Variable } from '#/shared/types';

interface Props {
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
}

/**
 * Collection variables editor for the Variables tab.
 */
export function VariablesSection({ variables, onChange }: Props): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <span className="text-[18px] text-muted">Variables</span>
      <p className="hc-form-description m-0 text-[14px] text-muted mb-2">
        Use variables in request URLs with {'{{variable}}'} syntax. When value is empty, the default
        is used. Values are omitted from export unless Share is checked.
      </p>
      <VariableTable variables={variables} onChange={onChange} />
    </div>
  );
}
