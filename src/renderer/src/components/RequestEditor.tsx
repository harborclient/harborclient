import { useState } from 'react'
import type { BodyType } from '#/shared/types'
import { KeyValueEditor } from '#/renderer/src/components/KeyValueEditor'
import { MethodSelect } from '#/renderer/src/components/MethodSelect'
import type { RequestDraft } from '#/renderer/src/store'
import {
  field,
  primaryButton,
  secondaryButton,
  segment,
  segmentGroup
} from '#/renderer/src/ui/classes'

type EditorTab = 'params' | 'headers' | 'body'

interface Props {
  /**
   * Current request being edited.
   */
  draft: RequestDraft

  /**
   * Called when any draft field changes.
   *
   * @param draft - Updated request draft.
   */
  onChange: (draft: RequestDraft) => void

  /**
   * Called when the user clicks Send.
   */
  onSend: () => void

  /**
   * Called when the user clicks Save.
   */
  onSave: () => void

  /**
   * Disables Send while a request is in flight.
   */
  sending: boolean
}

/**
 * Request builder: method, URL, params, headers, body, and send/save actions.
 */
export function RequestEditor({
  draft,
  onChange,
  onSend,
  onSave,
  sending
}: Props) {
  const [tab, setTab] = useState<EditorTab>('params')

  /**
   * Merges a partial update into the current draft.
   *
   * @param patch - Fields to update on the draft.
   */
  const update = (patch: Partial<RequestDraft>) => {
    onChange({ ...draft, ...patch })
  }

  const showBody = draft.method !== 'GET' && draft.method !== 'HEAD'

  return (
    <div className="border-b border-separator p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          className={`${field} max-w-xs`}
          type="text"
          placeholder="Request name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <button className={secondaryButton} onClick={onSave}>
          Save
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-md border border-separator bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]">
          <MethodSelect value={draft.method} onChange={(method) => update({ method })} />
          <div className="h-5 w-px shrink-0 bg-separator" />
          <input
            className="min-w-0 flex-1 border-none bg-transparent px-2 py-1.5 text-[13px] text-inherit app-no-drag focus-visible:shadow-none"
            type="text"
            placeholder="Enter request URL"
            value={draft.url}
            onChange={(e) => update({ url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend()
            }}
          />
        </div>
        <button className={primaryButton} onClick={onSend} disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="mt-4">
        <div className={segmentGroup}>
          <button className={segment(tab === 'params')} onClick={() => setTab('params')}>
            Params
          </button>
          <button className={segment(tab === 'headers')} onClick={() => setTab('headers')}>
            Headers
          </button>
          {showBody && (
            <button className={segment(tab === 'body')} onClick={() => setTab('body')}>
              Body
            </button>
          )}
        </div>
      </div>

      <div className="min-h-[160px] pt-2">
        {tab === 'params' && (
          <KeyValueEditor
            rows={draft.params}
            onChange={(params) => update({ params })}
            placeholderKey="param"
            placeholderValue="value"
          />
        )}
        {tab === 'headers' && (
          <KeyValueEditor
            rows={draft.headers}
            onChange={(headers) => update({ headers })}
            placeholderKey="header"
            placeholderValue="value"
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
              <textarea
                className="min-h-36 w-full resize-y rounded-md border border-separator bg-control p-2 font-mono text-[12px] text-inherit shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag"
                placeholder={
                  draft.body_type === 'json'
                    ? '{\n  "key": "value"\n}'
                    : 'Request body'
                }
                value={draft.body}
                onChange={(e) => update({ body: e.target.value })}
                spellCheck={false}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
