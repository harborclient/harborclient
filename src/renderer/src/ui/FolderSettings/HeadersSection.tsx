import { KeyValueEditor } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';
import { headerKeySource, headerValueSource } from '#/renderer/src/autocomplete/sources';

interface Props {
  /**
   * Folder header rows.
   */
  headers: KeyValue[];

  /**
   * Folder-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Called when header rows change.
   *
   * @param headers - Updated header rows.
   */
  onChange: (headers: KeyValue[]) => void;
}

/**
 * Folder headers editor for the Headers tab.
 */
export function HeadersSection({ headers, variables, onChange }: Props): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <span className="text-[18px] text-muted">Headers</span>
      <p className="hc-form-group-description m-0 text-[14px] text-muted mb-2">
        These headers are sent with every request in this folder. Header values support{' '}
        {'{{variable}}'} syntax. Request-level headers override folder headers with the same name.
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
