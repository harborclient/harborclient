import { useEffect, useRef, useState, type JSX } from 'react';
import type { BodyType, Variable } from '#/shared/types';
import { CodeEditor } from '#/renderer/src/components/CodeEditor';
import { KeyValueEditor } from '#/renderer/src/components/KeyValueEditor';
import { MethodSelect } from '#/renderer/src/components/MethodSelect';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { VariableInput } from '#/renderer/src/components/VariableInput';
import type { RequestDraft } from '#/renderer/src/store/drafts';
import { field, primaryButton } from './classes';

type EditorTab = 'params' | 'headers' | 'body' | 'pre' | 'post';

interface Props {
  /**
   * Current request being edited.
   */
  draft: RequestDraft;

  /**
   * Called when any draft field changes.
   *
   * @param draft - Updated request draft.
   */
  onChange: (draft: RequestDraft) => void;

  /**
   * Called when the user clicks Send.
   */
  onSend: () => void;

  /**
   * Disables Send while a request is in flight.
   */
  sending: boolean;

  /**
   * Collection-scoped variables for URL highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Name of the collection this request belongs to, for display as a breadcrumb prefix.
   */
  collectionName?: string;

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: () => void;
}

/**
 * Request builder: method, URL, params, headers, body, and send action.
 */
export function RequestEditor({
  draft,
  onChange,
  onSend,
  sending,
  variables,
  collectionName,
  onEditVariables
}: Props): JSX.Element {
  const [tab, setTab] = useState<EditorTab>('params');
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  /**
   * Merges a partial update into the current draft.
   *
   * @param patch - Fields to update on the draft.
   */
  const update = (patch: Partial<RequestDraft>): void => {
    onChange({ ...draft, ...patch });
  };

  const showBody = draft.method !== 'GET' && draft.method !== 'HEAD';

  return (
    <div className="border-b border-separator p-3">
      <div className="mb-2">
        {editingName ? (
          <div className="flex min-w-0 max-w-xs items-center gap-1">
            {collectionName && (
              <>
                <span className="shrink-0 text-[15px] font-normal text-muted">
                  {collectionName}
                </span>
                <span className="shrink-0 text-[15px] font-normal text-muted">&gt;</span>
              </>
            )}
            <input
              ref={nameInputRef}
              className="min-w-0 flex-1 border-none bg-transparent p-0 text-[15px] font-semibold text-text outline-none app-no-drag"
              type="text"
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  setEditingName(false);
                }
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="min-w-0 max-w-xs cursor-text border-none bg-transparent p-0 text-left text-[15px] font-semibold text-text hover:opacity-80 app-no-drag"
            onClick={() => setEditingName(true)}
          >
            {collectionName && (
              <>
                <span className="font-normal text-muted">{collectionName}</span>
                <span className="font-normal text-muted"> &gt; </span>
              </>
            )}
            {draft.name ? draft.name : <span className="text-muted">Request name</span>}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-md border border-separator bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]">
          <MethodSelect value={draft.method} onChange={(method) => update({ method })} />
          <div className="h-5 w-px shrink-0 bg-separator" />
          <VariableInput
            className="app-no-drag"
            value={draft.url}
            onChange={(url) => update({ url })}
            variables={variables}
            placeholder="Enter request URL"
            onEditVariable={onEditVariables}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend();
            }}
          />
        </div>
        <button className={primaryButton} onClick={onSend} disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="mt-4">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'params', label: 'Params' },
            { value: 'headers', label: 'Headers' },
            { value: 'body', label: 'Body', hidden: !showBody },
            { value: 'pre', label: 'PreRequest' },
            { value: 'post', label: 'PostRequest' }
          ]}
        />
      </div>

      <div className="min-h-[160px] pt-2">
        {tab === 'params' && (
          <KeyValueEditor
            rows={draft.params}
            onChange={(params) => update({ params })}
            placeholderKey="param"
            placeholderValue="value"
            variables={variables}
            onEditVariable={onEditVariables}
          />
        )}
        {tab === 'headers' && (
          <KeyValueEditor
            rows={draft.headers}
            onChange={(headers) => update({ headers })}
            placeholderKey="header"
            placeholderValue="value"
            variables={variables}
            onEditVariable={onEditVariables}
          />
        )}
        {tab === 'body' && showBody && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-[13px] text-muted">Body type</label>
              <select
                className={field}
                value={draft.body_type}
                onChange={(e) => update({ body_type: e.target.value as BodyType })}
              >
                <option value="none">None</option>
                <option value="json">JSON</option>
                <option value="text">Text</option>
              </select>
            </div>
            {draft.body_type !== 'none' && (
              <CodeEditor
                value={draft.body}
                onChange={(body) => update({ body })}
                language={draft.body_type === 'json' ? 'json' : 'text'}
                placeholder={draft.body_type === 'json' ? '{\n  "key": "value"\n}' : 'Request body'}
                variables={variables}
                onEditVariable={onEditVariables}
              />
            )}
          </div>
        )}
        {tab === 'pre' && (
          <CodeEditor
            value={draft.pre_request_script}
            onChange={(pre_request_script) => update({ pre_request_script })}
            language="javascript"
            scriptPhase="pre"
            placeholder="// hc.request.url = 'https://example.com';\n// hc.variables.set('token', 'abc');"
            variables={variables}
            onEditVariable={onEditVariables}
            minHeight="200px"
          />
        )}
        {tab === 'post' && (
          <CodeEditor
            value={draft.post_request_script}
            onChange={(post_request_script) => update({ post_request_script })}
            language="javascript"
            scriptPhase="post"
            placeholder={
              '// hc.test("status is 200", () => {\n//   hc.expect(hc.response.code).to.equal(200);\n// });'
            }
            variables={variables}
            onEditVariable={onEditVariables}
            minHeight="200px"
          />
        )}
      </div>
    </div>
  );
}
