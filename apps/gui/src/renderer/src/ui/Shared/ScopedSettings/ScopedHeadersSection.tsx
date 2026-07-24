import { FormSection, KeyValueEditor } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';
import { headerKeySource, headerValueSource } from '#/renderer/src/autocomplete/sources';

type Scope = 'collection' | 'folder';

interface Props {
  /**
   * Whether headers apply at collection or folder scope.
   */
  scope: Scope;

  /**
   * Draft header rows sent with every request in the scoped container.
   */
  headers: KeyValue[];

  /**
   * Scoped variables for autocomplete in header values.
   */
  variables: Variable[];

  /**
   * Updates the draft headers when the user edits the table.
   */
  onChange: (headers: KeyValue[]) => void;
}

/**
 * Headers editor for collection or folder settings tabs.
 */
export function ScopedHeadersSection({ scope, headers, variables, onChange }: Props): JSX.Element {
  return (
    <FormSection
      title="Headers"
      description={
        <>
          These headers are sent with every request in this {scope}. Header values support{' '}
          {'{{variable}}'} syntax. Request-level headers override {scope} headers with the same
          name.
        </>
      }
    >
      <KeyValueEditor
        rows={headers}
        onChange={onChange}
        placeholderKey="header"
        placeholderValue="value"
        variables={variables}
        keySource={headerKeySource}
        valueSource={headerValueSource}
      />
    </FormSection>
  );
}
