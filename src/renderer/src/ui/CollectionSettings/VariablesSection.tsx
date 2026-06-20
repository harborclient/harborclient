import type { JSX } from 'react';
import type { Variable } from '#/shared/types';
import { VariableTable } from '#/renderer/src/components/VariableTable';

interface Props {
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
}

/**
 * Collection variables editor for the Variables tab.
 */
export function VariablesSection({ variables, onChange }: Props): JSX.Element {
  return (
    <div className="mb-6">
      <VariableTable
        variables={variables}
        onChange={onChange}
        description={`Use variables in request URLs with {{variable}} syntax. When value is empty, the default is used. Values are omitted from export unless Share is checked.`}
      />
    </div>
  );
}
