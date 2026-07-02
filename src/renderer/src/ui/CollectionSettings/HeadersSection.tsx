import { KeyValueEditor } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';
import { headerKeySource, headerValueSource } from '#/renderer/src/autocomplete/sources';

interface Props {
  headers: KeyValue[];
  variables: Variable[];
  onChange: (headers: KeyValue[]) => void;
}

/**
 * Collection headers editor for the Headers tab.
 */
export function HeadersSection({ headers, variables, onChange }: Props): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <span className="text-[18px] text-muted">Headers</span>
      <p className="hc-form-description m-0 text-[14px] text-muted mb-2">
        These headers are sent with every request in this collection. Header values support{' '}
        {'{{variable}}'} syntax. Request-level headers override collection headers with the same
        name.
      </p>
      <KeyValueEditor
        rows={headers}
        onChange={onChange}
        placeholderKey="header"
        placeholderValue="value"
        variables={variables}
        keySource={headerKeySource}
        valueSource={headerValueSource}
      />
    </div>
  );
}
