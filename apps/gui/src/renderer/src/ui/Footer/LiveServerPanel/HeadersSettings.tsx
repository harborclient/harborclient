import { useMemo, type JSX } from 'react';
import { FormGroup, KeyValueEditor } from '@harborclient/sdk/components';
import type {
  KeyValue,
  LiveServerCorsSettings,
  LiveServerResponseHeader
} from '@harborclient/core/types';
import { headerKeySource, headerValueSource } from '#/renderer/src/autocomplete/sources';
import { CorsSettings } from './CorsSettings';
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
   * Current CORS settings from the editor draft.
   */
  cors: LiveServerCorsSettings;

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

  /**
   * Called with a full replacement CORS settings object after any field change.
   *
   * @param next - Updated CORS settings.
   */
  onCorsChange: (next: LiveServerCorsSettings) => void;
}

/**
 * Headers tab: editable response headers and CORS options for every Live Server
 * response (including 404). Uses the shared key/value table pattern for headers.
 *
 * @param props - Header rows, CORS settings, disabled flag, and change handlers.
 */
export function HeadersSettings({
  headers,
  cors,
  disabled,
  onChange,
  onCorsChange
}: Props): JSX.Element {
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
    <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
      <FormGroup
        label="Response headers"
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
      </FormGroup>

      <FormGroup
        label="CORS"
        description="Cross-Origin Resource Sharing options applied by the Express cors middleware before response headers."
      >
        <CorsSettings cors={cors} disabled={disabled} onChange={onCorsChange} />
      </FormGroup>
    </fieldset>
  );
}
