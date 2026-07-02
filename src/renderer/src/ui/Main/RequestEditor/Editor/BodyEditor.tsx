import {
  FormDataEditor,
  FormGroup,
  KeyValueEditor,
  CodeEditor,
  Radio
} from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { BodyType, Variable } from '#/shared/types';
import { parseFormParts, serializeFormParts } from '#/shared/formData';
import { parseUrlEncodedParts, serializeUrlEncodedParts } from '#/shared/urlencoded';

import type { RequestDraft } from '#/renderer/src/store/drafts';
import { emptyKeyValue } from '#/renderer/src/store/drafts';
import { urlencodedKeySource, urlencodedValueSource } from '#/renderer/src/autocomplete/sources';

const BODY_TYPE_OPTIONS: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'multipart', label: 'Multipart Form' },
  { value: 'urlencoded', label: 'Form URL Encoded' }
];

interface Props {
  /**
   * Content type of the request body.
   */
  bodyType: BodyType;

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Merges a partial update into the current draft.
   */
  update: (patch: Partial<RequestDraft>) => void;

  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: () => void;
}

/**
 * Body type selector and editor for JSON, text, multipart, and urlencoded bodies.
 */
export function BodyEditor({
  bodyType,
  body,
  update,
  variables,
  onEditVariables
}: Props): JSX.Element {
  const urlEncodedRows = bodyType === 'urlencoded' ? parseUrlEncodedParts(body) : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 border border-separator p-4">
        <span className="text-[16px] text-muted">Body type</span>
        {BODY_TYPE_OPTIONS.map(({ value, label }) => (
          <FormGroup key={value} label={label} layout="radio">
            <Radio
              name="body-type"
              className="app-no-drag"
              checked={bodyType === value}
              onChange={() => update({ body_type: value })}
            />
          </FormGroup>
        ))}
      </div>
      {bodyType === 'urlencoded' && (
        <KeyValueEditor
          rows={urlEncodedRows.length ? urlEncodedRows : [emptyKeyValue()]}
          onChange={(rows) => update({ body: serializeUrlEncodedParts(rows) })}
          placeholderKey="key"
          placeholderValue="value"
          variables={variables}
          onEditVariable={onEditVariables}
          keySource={urlencodedKeySource}
          valueSource={urlencodedValueSource}
        />
      )}
      {bodyType === 'multipart' && (
        <FormDataEditor
          parts={parseFormParts(body)}
          onChange={(parts) => update({ body: serializeFormParts(parts) })}
          variables={variables}
          onSelectFiles={window.api.selectFiles}
          onEditVariable={onEditVariables}
        />
      )}
      {bodyType !== 'none' && bodyType !== 'multipart' && bodyType !== 'urlencoded' && (
        <div className="border border-separator p-4">
          <CodeEditor
            value={body}
            onChange={(nextBody) => update({ body: nextBody })}
            language={bodyType === 'json' ? 'json' : 'text'}
            placeholder={bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body'}
            variables={variables}
            onEditVariable={onEditVariables}
          />
        </div>
      )}
    </div>
  );
}
