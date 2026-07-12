import type {
  AiScriptReferenceValidationContext,
  TerminalSelectionSnapshot
} from '#/shared/ai/scriptReferences';
import type { Collection, Folder, SavedRequest, Snippet } from '#/shared/types';
import { useMemo } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { isRequestTab } from '#/renderer/src/store/drafts';
import type { RootState } from '#/renderer/src/store/redux';
import {
  selectActiveTab,
  selectCollections,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectSnippets
} from '#/renderer/src/store/selectors';
import { selectTerminalSelections } from '#/renderer/src/store/slices/terminalsSlice';

/**
 * Sidebar item display names keyed by uuid for `@collection`, `@folder`, and `@request` badges.
 */
export interface SidebarItemNameMaps {
  /**
   * Collection display names keyed by uuid.
   */
  collectionNamesByUuid: Record<string, string>;

  /**
   * Folder display names keyed by uuid.
   */
  folderNamesByUuid: Record<string, string>;

  /**
   * Saved request display names keyed by uuid.
   */
  requestNamesByUuid: Record<string, string>;
}

/**
 * Builds uuid-to-name maps for collection, folder, and request `@` references.
 *
 * @param collections - All loaded collections.
 * @param foldersByCollection - Cached folders keyed by collection id.
 * @param requestsByCollection - Cached requests keyed by collection id.
 */
export function buildSidebarItemNameMaps(
  collections: Collection[],
  foldersByCollection: Record<number, Folder[]>,
  requestsByCollection: Record<number, SavedRequest[]>
): SidebarItemNameMaps {
  const collectionNamesByUuid: Record<string, string> = {};
  for (const collection of collections) {
    collectionNamesByUuid[collection.uuid] = collection.name;
  }

  const folderNamesByUuid: Record<string, string> = {};
  for (const folders of Object.values(foldersByCollection)) {
    for (const folder of folders) {
      folderNamesByUuid[folder.uuid] = folder.name;
    }
  }

  const requestNamesByUuid: Record<string, string> = {};
  for (const requests of Object.values(requestsByCollection)) {
    for (const request of requests) {
      requestNamesByUuid[request.uuid] = request.name;
    }
  }

  return { collectionNamesByUuid, folderNamesByUuid, requestNamesByUuid };
}

/**
 * Builds sidebar item name maps from the current Redux root state.
 *
 * @param state - Current Redux root state.
 */
export function buildSidebarItemNameMapsFromState(state: RootState): SidebarItemNameMaps {
  return buildSidebarItemNameMaps(
    selectCollections(state),
    selectFoldersByCollection(state),
    selectRequestsByCollection(state)
  );
}

/**
 * Builds validation context from the active request tab for `@` script references.
 *
 * @param tab - Active editor tab, if any.
 */
function buildValidationContext(
  tab: ReturnType<typeof selectActiveTab>
): Omit<AiScriptReferenceValidationContext, 'snippets'> {
  if (!tab || !isRequestTab(tab)) {
    return {
      hasActiveRequestTab: false,
      preScriptCount: 0,
      postScriptCount: 0
    };
  }

  return {
    hasActiveRequestTab: true,
    activeRequestId: tab.draft.id,
    preScriptCount: tab.draft.pre_request_scripts.length,
    postScriptCount: tab.draft.post_request_scripts.length,
    preScripts: tab.draft.pre_request_scripts,
    postScripts: tab.draft.post_request_scripts
  };
}

/**
 * Builds the full validation context used by chat UI and send-time script expansion.
 *
 * @param tab - Active editor tab, if any.
 * @param snippets - Snippet library for resolving snippet-linked script names and source.
 * @param terminalSelections - Terminal selection snapshots keyed by `@term` reference token.
 * @param sidebarNames - Collection, folder, and request name maps for sidebar `@` references.
 */
export function buildAiScriptReferenceValidationContext(
  tab: ReturnType<typeof selectActiveTab>,
  snippets: Snippet[],
  terminalSelections: Record<string, TerminalSelectionSnapshot> = {},
  sidebarNames: Partial<SidebarItemNameMaps> = {}
): AiScriptReferenceValidationContext {
  return {
    ...buildValidationContext(tab),
    snippets,
    terminalSelections,
    collectionNamesByUuid: sidebarNames.collectionNamesByUuid,
    folderNamesByUuid: sidebarNames.folderNamesByUuid,
    requestNamesByUuid: sidebarNames.requestNamesByUuid
  };
}

/**
 * Returns the active request tab state used to validate `@` script references in chat UI.
 */
export function useAiScriptReferenceValidationContext(): AiScriptReferenceValidationContext {
  const activeTab = useAppSelector(selectActiveTab);
  const snippets = useAppSelector(selectSnippets);
  const terminalSelections = useAppSelector(selectTerminalSelections);
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);

  /**
   * Memoizes script counts, script rows, snippet lookup data, terminal snapshots, and sidebar names.
   */
  const sidebarNames = useMemo(
    () => buildSidebarItemNameMaps(collections, foldersByCollection, requestsByCollection),
    [collections, foldersByCollection, requestsByCollection]
  );

  return useMemo(
    () =>
      buildAiScriptReferenceValidationContext(
        activeTab,
        snippets,
        terminalSelections,
        sidebarNames
      ),
    [activeTab, snippets, terminalSelections, sidebarNames]
  );
}
