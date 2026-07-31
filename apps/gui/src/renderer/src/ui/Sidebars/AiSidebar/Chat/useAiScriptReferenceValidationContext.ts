import type {
  AiScriptReferenceValidationContext,
  ConsoleRowSnapshot,
  LiveServerReferenceInfo,
  LogsSelectionSnapshot,
  MarkdownSelectionSnapshot,
  PluginChatPointerSnapshot,
  RequestBodySelectionSnapshot,
  ResponseSectionSnapshot,
  ScriptSelectionSnapshot,
  TerminalSelectionSnapshot,
  WebpageTabReferenceInfo
} from '@harborclient/core/ai/scriptReferences';
import type {
  Collection,
  Folder,
  LiveServer,
  RunningLiveServer,
  SavedRequest,
  Snippet
} from '@harborclient/core/types';
import { useMemo } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import type { RootState } from '#/renderer/src/store/redux';
import {
  selectEffectiveActiveRequestTab,
  selectCollections,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectRunningLiveServers,
  selectSavedLiveServers,
  selectSnippets,
  selectTabs
} from '#/renderer/src/store/selectors';
import { isBrowserTab } from '#/renderer/src/store/tabs';
import { selectTerminalSelections } from '#/renderer/src/store/slices/terminalsSlice';
import { selectLiveServerLogsSelections } from '#/renderer/src/store/slices/liveServersSlice';
import { selectMarkdownSelections } from '#/renderer/src/store/slices/markdownSelectionsSlice';
import { selectRequestBodySelections } from '#/renderer/src/store/slices/requestBodySelectionsSlice';
import { selectResponseSelections } from '#/renderer/src/store/slices/responseSelectionsSlice';
import { selectConsoleSelections } from '#/renderer/src/store/slices/consoleSelectionsSlice';
import { selectScriptSelections } from '#/renderer/src/store/slices/scriptSelectionsSlice';
import { selectPluginSelections } from '#/renderer/src/store/slices/pluginSelectionsSlice';

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
 * Builds validation context from the effective active request tab for `@` script references.
 *
 * @param tab - Effective request tab (directly active or linked from a script-editor page tab).
 */
function buildValidationContext(
  tab: ReturnType<typeof selectEffectiveActiveRequestTab>
): Omit<AiScriptReferenceValidationContext, 'snippets'> {
  if (!tab) {
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
 * Builds open browser-tab summaries keyed by tab id for `@webpage` validation.
 *
 * @param tabs - All open editor tabs from Redux.
 * @returns Map of browser tab id → title/url for chat-pointer resolution.
 */
export function buildWebpageTabsById(
  tabs: RootState['tabs']['tabs']
): Record<string, WebpageTabReferenceInfo> {
  const webpageTabsById: Record<string, WebpageTabReferenceInfo> = {};
  for (const tab of tabs) {
    if (isBrowserTab(tab)) {
      webpageTabsById[tab.tabId] = { title: tab.title, url: tab.url };
    }
  }
  return webpageTabsById;
}

/**
 * Builds open browser-tab summaries from the current Redux root state.
 *
 * @param state - Current Redux root state.
 */
export function buildWebpageTabsByIdFromState(
  state: RootState
): Record<string, WebpageTabReferenceInfo> {
  return buildWebpageTabsById(selectTabs(state));
}

/**
 * Builds saved live-server summaries keyed by uuid for `@live-server` validation.
 *
 * @param saved - Saved live servers from Redux.
 * @param running - Currently running live server instances.
 * @returns Map of saved uuid → config plus optional running origin.
 */
export function buildLiveServersByUuid(
  saved: LiveServer[],
  running: RunningLiveServer[]
): Record<string, LiveServerReferenceInfo> {
  const runningBySavedId = new Map<number, RunningLiveServer>();
  for (const instance of running) {
    if (instance.savedId != null) {
      runningBySavedId.set(instance.savedId, instance);
    }
  }

  const liveServersByUuid: Record<string, LiveServerReferenceInfo> = {};
  for (const server of saved) {
    const instance = runningBySavedId.get(server.id);
    liveServersByUuid[server.uuid] = {
      id: server.id,
      name: server.name,
      root: server.root,
      port: server.port,
      watch: server.watch,
      ...(instance != null
        ? {
            runtimeId: instance.id,
            origin: instance.origin,
            runningPort: instance.port
          }
        : {})
    };
  }
  return liveServersByUuid;
}

/**
 * Builds saved live-server summaries from the current Redux root state.
 *
 * @param state - Current Redux root state.
 */
export function buildLiveServersByUuidFromState(
  state: RootState
): Record<string, LiveServerReferenceInfo> {
  return buildLiveServersByUuid(selectSavedLiveServers(state), selectRunningLiveServers(state));
}

/**
 * Builds the full validation context used by chat UI and send-time script expansion.
 *
 * @param tab - Active editor tab, if any.
 * @param snippets - Snippet library for resolving snippet-linked script names and source.
 * @param terminalSelections - Terminal selection snapshots keyed by `@term` reference token.
 * @param markdownSelections - Markdown selection snapshots keyed by `@markdown` reference token.
 * @param sidebarNames - Collection, folder, and request name maps for sidebar `@` references.
 * @param requestBodySelections - Raw-body selection snapshots keyed by `@body` reference token.
 * @param scriptSelections - Request-script selection snapshots keyed by `@` script reference token.
 * @param responseSelections - Response-section snapshots keyed by `@res` reference token.
 * @param pluginSelections - Plugin chat-pointer snapshots keyed by `@plugin…` reference token.
 * @param webpageTabsById - Open browser tabs keyed by tab id for `@webpage` references.
 * @param liveServersByUuid - Saved live servers keyed by uuid for `@live-server` / `@logs` references.
 * @param logsSelections - Access-log selection snapshots keyed by `@logs` reference token.
 * @param consoleSelections - Console/header/timing row snapshots keyed by `@console` token.
 */
export function buildAiScriptReferenceValidationContext(
  tab: ReturnType<typeof selectEffectiveActiveRequestTab>,
  snippets: Snippet[],
  terminalSelections: Record<string, TerminalSelectionSnapshot> = {},
  markdownSelections: Record<string, MarkdownSelectionSnapshot> = {},
  sidebarNames: Partial<SidebarItemNameMaps> = {},
  requestBodySelections: Record<string, RequestBodySelectionSnapshot> = {},
  scriptSelections: Record<string, ScriptSelectionSnapshot> = {},
  responseSelections: Record<string, ResponseSectionSnapshot> = {},
  pluginSelections: Record<string, PluginChatPointerSnapshot> = {},
  webpageTabsById: Record<string, WebpageTabReferenceInfo> = {},
  liveServersByUuid: Record<string, LiveServerReferenceInfo> = {},
  logsSelections: Record<string, LogsSelectionSnapshot> = {},
  consoleSelections: Record<string, ConsoleRowSnapshot> = {}
): AiScriptReferenceValidationContext {
  return {
    ...buildValidationContext(tab),
    snippets,
    terminalSelections,
    markdownSelections,
    requestBodySelections,
    scriptSelections,
    responseSelections,
    consoleSelections,
    pluginSelections,
    webpageTabsById,
    liveServersByUuid,
    logsSelections,
    collectionNamesByUuid: sidebarNames.collectionNamesByUuid,
    folderNamesByUuid: sidebarNames.folderNamesByUuid,
    requestNamesByUuid: sidebarNames.requestNamesByUuid
  };
}

/**
 * Returns the active request tab state used to validate `@` script references in chat UI.
 */
export function useAiScriptReferenceValidationContext(): AiScriptReferenceValidationContext {
  const activeTab = useAppSelector(selectEffectiveActiveRequestTab);
  const snippets = useAppSelector(selectSnippets);
  const terminalSelections = useAppSelector(selectTerminalSelections);
  const logsSelections = useAppSelector(selectLiveServerLogsSelections);
  const markdownSelections = useAppSelector(selectMarkdownSelections);
  const requestBodySelections = useAppSelector(selectRequestBodySelections);
  const scriptSelections = useAppSelector(selectScriptSelections);
  const responseSelections = useAppSelector(selectResponseSelections);
  const consoleSelections = useAppSelector(selectConsoleSelections);
  const pluginSelections = useAppSelector(selectPluginSelections);
  const tabs = useAppSelector(selectTabs);
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const savedLiveServers = useAppSelector(selectSavedLiveServers);
  const runningLiveServers = useAppSelector(selectRunningLiveServers);

  /**
   * Memoizes script counts, script rows, snippet lookup data, terminal snapshots, and sidebar names.
   */
  const sidebarNames = useMemo(
    () => buildSidebarItemNameMaps(collections, foldersByCollection, requestsByCollection),
    [collections, foldersByCollection, requestsByCollection]
  );

  /**
   * Memoizes open browser tabs for `@webpage.<tabId>` badge and send-time context.
   */
  const webpageTabsById = useMemo(() => buildWebpageTabsById(tabs), [tabs]);

  /**
   * Memoizes saved live servers for `@live-server.<uuid>` badge and send-time context.
   */
  const liveServersByUuid = useMemo(
    () => buildLiveServersByUuid(savedLiveServers, runningLiveServers),
    [savedLiveServers, runningLiveServers]
  );

  return useMemo(
    () =>
      buildAiScriptReferenceValidationContext(
        activeTab,
        snippets,
        terminalSelections,
        markdownSelections,
        sidebarNames,
        requestBodySelections,
        scriptSelections,
        responseSelections,
        pluginSelections,
        webpageTabsById,
        liveServersByUuid,
        logsSelections,
        consoleSelections
      ),
    [
      activeTab,
      snippets,
      terminalSelections,
      markdownSelections,
      sidebarNames,
      requestBodySelections,
      scriptSelections,
      responseSelections,
      pluginSelections,
      webpageTabsById,
      liveServersByUuid,
      logsSelections,
      consoleSelections
    ]
  );
}
