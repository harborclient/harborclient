import { VariableTable, FormSection } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { Variable } from '#/shared/types';

interface Props {
  /**
   * Draft collection-scoped variables shown in the table.
   */
  variables: Variable[];

  /**
   * Updates the draft variables when the user edits the table.
   */
  onChange: (variables: Variable[]) => void;

  /**
   * When set, focuses the matching variable row in the table.
   */
  focusVariableKey?: string;
}

/**
 * Collection variables editor for the Variables tab.
 */
export function VariablesSection({ variables, onChange, focusVariableKey }: Props): JSX.Element {
  return (
    <FormSection
      title="Variables"
      description={
        <>
          Use variables in request URLs with {'{{variable}}'} syntax. When value is empty, the
          default is used. Values are omitted from export unless Share is checked.
        </>
      }
    >
      <VariableTable variables={variables} onChange={onChange} focusKey={focusVariableKey} />
    </FormSection>
  );
}
