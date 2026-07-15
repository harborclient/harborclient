import { useEffect, useMemo, type JSX } from 'react';
import type { PageRef } from '#/renderer/src/store/drafts';
import { isRequestTab } from '#/renderer/src/store/drafts';
import { mirrorLegacyScriptString } from '#/shared/scriptRefs';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectEnvironments,
  selectFoldersByCollection
} from '#/renderer/src/store/selectors';
import { closeTab, openPageTab, updateTab } from '#/renderer/src/store/slices/tabsSlice';
import { useMergedRequestVariables } from '#/renderer/src/hooks/useMergedRequestVariables';
import { resolveVariableEditTarget } from '#/renderer/src/ui/Main/RequestEditor/resolveVariableEditTarget';
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
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const requestTab = tabs.find((entry) => entry.tabId === page.requestTabId);
  const draft = requestTab && isRequestTab(requestTab) ? requestTab.draft : null;
  const activeFolderId = useMemo(() => {
    if (draft?.collection_id == null) return null;
    return draft.folder_id ?? null;
  }, [draft?.collection_id, draft?.folder_id]);
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

  /**
   * Opens the page tab where the hovered variable is defined.
   *
   * @param key - Variable name from the editor token.
   */
  const handleEditVariables = (key: string): void => {
    const activeCollection =
      draft?.collection_id != null
        ? collections.find((entry) => entry.id === draft.collection_id)
        : undefined;
    const activeEnvironment =
      activeEnvironmentId != null
        ? environments.find((entry) => entry.id === activeEnvironmentId)
        : undefined;

    const activeFolder =
      draft?.collection_id != null && activeFolderId != null
        ? (foldersByCollection[draft.collection_id] ?? []).find(
            (entry) => entry.id === activeFolderId
          )
        : undefined;

    const target = resolveVariableEditTarget({
      key,
      globalVariables,
      collectionVariables: activeCollection?.variables ?? [],
      folderVariables: activeFolder?.variables ?? [],
      environmentVariables: activeEnvironment?.variables ?? [],
      activeCollectionId: draft?.collection_id ?? null,
      activeFolderId,
      activeEnvironmentId
    });
    if (target == null) {
      return;
    }

    if (target.scope === 'environment' && target.environmentId != null) {
      dispatch(
        openPageTab({
          type: 'environment',
          id: target.environmentId,
          focusVariableKey: key
        })
      );
      return;
    }

    if (target.scope === 'collection' && target.collectionId != null) {
      dispatch(
        openPageTab({
          type: 'collection',
          id: target.collectionId,
          focusVariableKey: key
        })
      );
      return;
    }

    if (target.scope === 'folder' && target.folderId != null) {
      dispatch(
        openPageTab({
          type: 'folder',
          collectionId: target.collectionId ?? draft?.collection_id ?? 0,
          id: target.folderId,
          focusVariableKey: key
        })
      );
      return;
    }

    dispatch(
      openPageTab({
        type: 'settings',
        section: 'globals',
        focusVariableKey: key
      })
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ScriptListEditor
        variant="single"
        focusScriptId={page.scriptId}
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
        onEditVariables={handleEditVariables}
        snippets={snippets}
        placeholder={placeholder}
      />
    </div>
  );
}
