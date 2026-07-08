import { useCallback, type JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';
import { applyParamsToUrl, mergeParamsFromUrl } from '#/shared/queryParams';

import type { RequestTabContext } from '#/shared/plugin/types';
import type { RequestDraft } from '#/renderer/src/store/drafts';
import { EditorTabs } from './EditorTabs';
import { Name } from './Name';
import { UrlBar } from './UrlBar';

interface Props {
  /**
   * Current request being edited.
   */
  draft: RequestDraft;

  /**
   * Open tab id for per-request editor tab persistence.
   */
  tabId: string;

  /**
   * Read-only plugin tab context shared with contributed tabs.
   */
  requestTabContext: RequestTabContext;

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
   * Name of the folder this request belongs to, for display as a breadcrumb segment.
   */
  folderName?: string;

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;

  /**
   * Called when the collection breadcrumb segment is clicked.
   */
  onCollectionClick?: () => void;

  /**
   * Called when the folder breadcrumb segment is clicked.
   */
  onFolderClick?: () => void;
}

/**
 * Request builder: method, URL, params, headers, body, and send action.
 */
export function Editor({
  draft,
  tabId,
  requestTabContext,
  onChange,
  onSend,
  sending,
  variables,
  collectionName,
  folderName,
  onEditVariables,
  onCollectionClick,
  onFolderClick
}: Props): JSX.Element {
  /**
   * Merges a partial update into the current draft.
   *
   * @param patch - Fields to update on the draft.
   */
  const update = useCallback(
    (patch: Partial<RequestDraft>): void => {
      onChange({ ...draft, ...patch });
    },
    [draft, onChange]
  );

  /**
   * Updates the URL and mirrors its query string into the params table.
   *
   * @param url - URL typed in the URL bar.
   */
  const handleUrlChange = (url: string): void => {
    update({ url, params: mergeParamsFromUrl(url, draft.params) });
  };

  /**
   * Updates params and rewrites the URL query string from enabled rows.
   *
   * @param params - Updated params table rows.
   */
  const handleParamsChange = (params: KeyValue[]): void => {
    update({ params, url: applyParamsToUrl(draft.url, params) });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-separator p-3">
        <Name
          name={draft.name}
          collectionName={collectionName}
          folderName={folderName}
          onNameChange={(name) => update({ name })}
          onCollectionClick={onCollectionClick}
          onFolderClick={onFolderClick}
        />

        <UrlBar
          method={draft.method}
          url={draft.url}
          variables={variables}
          sending={sending}
          onMethodChange={(method) => update({ method })}
          onUrlChange={handleUrlChange}
          onSend={onSend}
          onEditVariables={onEditVariables}
        />
      </div>

      <EditorTabs
        draft={draft}
        tabId={tabId}
        requestTabContext={requestTabContext}
        update={update}
        onParamsChange={handleParamsChange}
        variables={variables}
        onEditVariables={onEditVariables}
      />
    </div>
  );
}
