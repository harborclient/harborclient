import { SegmentedTabs, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { useCallback, useMemo, type JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';
import { ensureDefaultScriptRef, hasScriptContent } from '#/shared/scriptRefs';

import type { RequestTabContext } from '#/shared/plugin/types';
import type { RequestDraft } from '#/renderer/src/store/drafts';
import { usePluginRequestTabs } from '#/renderer/src/plugins/pluginHooks';

import { TabContent } from './TabContent';
import { DEFAULT_REQUEST_COMMENT, hasUserCommentContent } from './commentDefaults';
import { useHasCookies } from './useHasCookies';
import { usePersistedEditorTab } from './usePersistedEditorTab';

/**
 * Returns whether any key-value row has a non-empty key or value.
 *
 * @param rows - Key-value rows from params, headers, or cookies.
 * @returns True when at least one row has content.
 */
function hasKeyValue(rows: KeyValue[]): boolean {
  return rows.some((row) => row.key.trim() || row.value.trim());
}

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
   * Merges a partial update into the current draft.
   */
  update: (patch: Partial<RequestDraft>) => void;

  /**
   * Updates params and rewrites the URL query string from enabled rows.
   *
   * @param params - Updated params table rows.
   */
  onParamsChange: (params: KeyValue[]) => void;

  /**
   * Collection-scoped variables for URL highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: () => void;
}

/**
 * Segmented tab bar and panel area for params, headers, body, scripts, and plugin tabs.
 */
export function EditorTabs({
  draft,
  tabId,
  requestTabContext,
  update,
  onParamsChange,
  variables,
  onEditVariables
}: Props): JSX.Element {
  const pluginTabs = usePluginRequestTabs();
  const showBody = draft.method !== 'GET' && draft.method !== 'HEAD';

  /**
   * Seeds default tab content when entering script or comment tabs with empty values.
   *
   * @param nextTab - Editor tab the user selected or restored.
   */
  const seedEditorTab = useCallback(
    (nextTab: string): void => {
      if (nextTab === 'pre' && draft.pre_request_scripts.length === 0) {
        update({ pre_request_scripts: ensureDefaultScriptRef(draft.pre_request_scripts) });
      }
      if (nextTab === 'post' && draft.post_request_scripts.length === 0) {
        update({ post_request_scripts: ensureDefaultScriptRef(draft.post_request_scripts) });
      }
      if (nextTab === 'comment' && draft.comment.trim() === '') {
        update({ comment: DEFAULT_REQUEST_COMMENT });
      }
    },
    [draft.comment, draft.post_request_scripts, draft.pre_request_scripts, update]
  );

  const { tab, setTab } = usePersistedEditorTab({
    draft,
    tabId,
    showBody,
    onTabResolved: seedEditorTab
  });
  const hasCookies = useHasCookies(draft.url, variables);

  /**
   * Per-tab indicators for whether each editor section has values set.
   */
  const tabIndicators = useMemo(
    () => ({
      params: hasKeyValue(draft.params),
      headers: hasKeyValue(draft.headers),
      auth: draft.auth.type !== 'none',
      cookies: hasCookies,
      body: showBody && draft.body.trim().length > 0,
      pre: hasScriptContent(draft.pre_request_scripts),
      post: hasScriptContent(draft.post_request_scripts),
      comment: hasUserCommentContent(draft.comment)
    }),
    [
      draft.params,
      draft.headers,
      draft.auth,
      draft.body,
      draft.pre_request_scripts,
      draft.post_request_scripts,
      draft.comment,
      hasCookies,
      showBody
    ]
  );

  /**
   * Built-in and plugin request editor tabs merged for SegmentedTabs.
   */
  const tabs = useMemo(
    () => [
      { value: 'params', label: 'Params', indicator: tabIndicators.params },
      { value: 'headers', label: 'Headers', indicator: tabIndicators.headers },
      { value: 'auth', label: 'Authorization', indicator: tabIndicators.auth },
      { value: 'cookies', label: 'Cookies', indicator: tabIndicators.cookies },
      { value: 'body', label: 'Body', hidden: !showBody, indicator: tabIndicators.body },
      { value: 'pre', label: 'PreRequest', indicator: tabIndicators.pre },
      { value: 'post', label: 'PostRequest', indicator: tabIndicators.post },
      { value: 'comment', label: 'Notes', indicator: tabIndicators.comment },
      ...pluginTabs.map((entry) => ({ value: entry.id, label: entry.title }))
    ],
    [pluginTabs, showBody, tabIndicators]
  );

  /**
   * Seeds default tab content when entering script or comment tabs with empty values.
   *
   * @param nextTab - Editor tab the user selected.
   */
  const handleTabChange = (nextTab: string): void => {
    seedEditorTab(nextTab);
    setTab(nextTab);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentedTabsGroup
        value={tab}
        onChange={handleTabChange}
        ariaLabel="Request editor sections"
      >
        <div className="shrink-0">
          <SegmentedTabs tabs={tabs} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4">
          <TabContent
            draft={draft}
            showBody={showBody}
            update={update}
            onParamsChange={onParamsChange}
            variables={variables}
            onEditVariables={onEditVariables}
            pluginTabs={pluginTabs}
            requestTabContext={requestTabContext}
          />
        </div>
      </SegmentedTabsGroup>
    </div>
  );
}
