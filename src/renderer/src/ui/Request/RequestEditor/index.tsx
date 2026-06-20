import { useState, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import type { RequestDraft } from '#/renderer/src/store/drafts';
import { RequestName } from './RequestName';
import { RequestTabContent } from './RequestTabContent';
import { RequestUrlBar } from './RequestUrlBar';
import type { EditorTab } from './types';

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
    <div className="p-3">
      <RequestName
        name={draft.name}
        collectionName={collectionName}
        onNameChange={(name) => update({ name })}
      />

      <RequestUrlBar
        method={draft.method}
        url={draft.url}
        variables={variables}
        sending={sending}
        onMethodChange={(method) => update({ method })}
        onUrlChange={(url) => update({ url })}
        onSend={onSend}
        onEditVariables={onEditVariables}
      />

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

      <RequestTabContent
        tab={tab}
        draft={draft}
        showBody={showBody}
        update={update}
        variables={variables}
        onEditVariables={onEditVariables}
      />
    </div>
  );
}
