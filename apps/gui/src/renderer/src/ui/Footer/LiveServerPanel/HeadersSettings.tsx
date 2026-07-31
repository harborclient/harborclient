import { useMemo, type JSX } from 'react';
import { FormSection, KeyValueEditor } from '@harborclient/sdk/components';
import type { KeyValue, LiveServerResponseHeader } from '@harborclient/core/types';
import { headerKeySource, headerValueSource } from '#/renderer/src/autocomplete/sources';
import {
  keyValueRowsToLiveServerHeaders,
  liveServerHeadersToKeyValueRows
} from './liveServerHeaderRows';

interface Props {
  /**
   * Custom response-header rows from the editor draft.
   */
  headers: LiveServerResponseHeader[];

  /**
   * When true, disables the table (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called with the full replacement header list after any edit.
   *
   * @param next - Updated header rows (may include a trailing empty name).
   */
  onChange: (next: LiveServerResponseHeader[]) => void;
}

/**
 * Headers tab: editable list of response headers applied to every Live Server
 * response (including 404). Uses the shared key/value table pattern.
 *
 * @param props - Header rows, disabled flag, and change handler.
 */
export function HeadersSettings({ headers, disabled, onChange }: Props): JSX.Element {
  /**
   * KeyValueEditor rows derived from modal headers, with a trailing blank row.
   */
  const rows = useMemo(() => liveServerHeadersToKeyValueRows(headers), [headers]);

  /**
   * Maps editor key/value rows back to live-server header shape.
   *
   * @param nextRows - Rows from {@link KeyValueEditor}.
   */
  function handleChange(nextRows: KeyValue[]): void {
    onChange(keyValueRowsToLiveServerHeaders(nextRows));
  }

  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <FormSection
        title="Response headers"
        description={
          <>
            Applied to every response after CORS (including 404). Examples:{' '}
            <code>Cache-Control: no-store</code>, CSP, COOP, COEP. Leave the list empty for no
            custom headers. Uncheck a row to keep it without sending it.
          </>
        }
      >
        <KeyValueEditor
          rows={rows}
          onChange={handleChange}
          placeholderKey="Header"
          placeholderValue="Value"
          variables={[]}
          keySource={headerKeySource}
          valueSource={headerValueSource}
        />
      </FormSection>
    </fieldset>
  );
}
