import { useEffect, useMemo, type JSX } from 'react';
import type { PageRef } from '#/renderer/src/store/tabs';
import { isRequestTab } from '#/renderer/src/store/tabs';
import { mirrorLegacyScriptString } from '@harborclient/core/scriptRefs';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { closeTab, updateTab } from '#/renderer/src/store/slices/tabsSlice';
import { useMergedRequestVariables } from '#/renderer/src/hooks/useMergedRequestVariables';
import { useEditVariableNavigation } from './useEditVariableNavigation';
import { ScriptListEditor } from '#/renderer/src/ui/Shared/Script/ScriptListEditor';
import {
  POST_REQUEST_SCRIPT_PLACEHOLDER,
  PRE_REQUEST_SCRIPT_PLACEHOLDER
} from '#/renderer/src/ui/Shared/Script/scriptPlaceholders';

interface Props {
  /**
   * Active script editor page tab identity.
   */
  page: Extract<PageRef, { type: 'script-editor' }>;

  /**
   * Tab id hosting this page (used to close stale tabs).
   */
  tabId: string;
}

/**
 * Renders a live-linked single-script editor page tab for one request script row.
 */
export function ScriptEditorTab({ page, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector((state) => state.tabs.tabs);
  const snippets = useAppSelector(selectSnippets);
  const requestTab = tabs.find((entry) => entry.tabId === page.requestTabId);
  const linkedRequestTab = requestTab && isRequestTab(requestTab) ? requestTab : null;
  const draft = linkedRequestTab?.draft ?? null;
  const activeFolderId = useMemo(() => {
    if (draft?.collection_id == null) return null;
    return draft.folder_id ?? null;
  }, [draft?.collection_id, draft?.folder_id]);
  const onEditVariables = useEditVariableNavigation(draft?.collection_id ?? null, activeFolderId);
  const variables = useMergedRequestVariables(draft?.collection_id, activeFolderId);
  const scriptsKey = page.phase === 'pre' ? 'pre_request_scripts' : 'post_request_scripts';
  const legacyKey = page.phase === 'pre' ? 'pre_request_script' : 'post_request_script';
  const scripts = draft?.[scriptsKey] ?? [];
  const scriptExists = scripts.some((script) => script.id === page.scriptId);
  const placeholder =
    page.phase === 'pre' ? PRE_REQUEST_SCRIPT_PLACEHOLDER : POST_REQUEST_SCRIPT_PLACEHOLDER;

  /**
   * Closes this tab when the source request tab or linked script row is gone.
   */
  useEffect(() => {
    if (!draft || !scriptExists) {
      dispatch(closeTab(tabId));
    }
  }, [draft, dispatch, scriptExists, tabId]);

  if (!draft || !scriptExists) {
    return <></>;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ScriptListEditor
        variant="single"
        focusScriptId={page.scriptId}
        revealLine={page.revealLine}
        revealColumn={page.revealColumn}
        revealMessage={page.revealMessage}
        revealSource={page.revealSource}
        revealNonce={page.revealNonce}
        testResults={linkedRequestTab?.testResults}
        scriptErrors={linkedRequestTab?.scriptErrors ?? []}
        phase={page.phase}
        scripts={scripts}
        requestId={draft.id}
        sourceTabId={page.requestTabId}
        onChange={(nextScripts) =>
          dispatch(
            updateTab({
              tabId: page.requestTabId,
              updates: {
                draft: {
                  ...draft,
                  [scriptsKey]: nextScripts,
                  [legacyKey]: mirrorLegacyScriptString(nextScripts)
                }
              }
            })
          )
        }
        variables={variables}
        onEditVariables={onEditVariables}
        snippets={snippets}
        placeholder={placeholder}
      />
    </div>
  );
}
