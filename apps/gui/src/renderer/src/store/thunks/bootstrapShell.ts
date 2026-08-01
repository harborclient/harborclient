import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AppDispatch, ThunkApiConfig } from '#/renderer/src/store/redux';
import { setGeneralSettingsState } from '#/renderer/src/store/slices/settingsSlice';
import { selectDraft } from '#/renderer/src/store/selectors';
import { hydratePanelLayoutFromSettings } from '#/renderer/src/store/panelLayoutHydration';
import { setPrefetchedSidebarExpansion } from '#/renderer/src/store/sidebarExpansionPrefetch';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import {
  refreshCollections,
  refreshCollectionContents,
  openSeededBuiltinRequestIfNeeded
} from './collections';
import { refreshEnvironments } from './environments';
import { refreshRunResults } from './runResults';
import { refreshRequestHistory } from './requestHistory';
import { refreshWorkflowRunHistory } from './workflowRunHistory';
import { refreshWorkspaces } from './workspaces';
import { refreshWorkflows } from './workflows';
import { refreshWebsites } from './websites';
import { refreshLiveServers, refreshRunningLiveServers } from './liveServers';
import { refreshTrash } from './trash';
import { refreshSnippets } from './snippets';
import { hydrateOpenTabs } from './tabs';
import { hydrateTerminalLayout } from './terminals';

/**
 * Waits for two animation frames so React can commit layout before the main
 * window is shown.
 *
 * @returns Promise that resolves after the second animation frame.
 */
export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

/**
 * Loads shell data required for a stable first paint before the main window is shown.
 *
 * Prefetches sidebar expansion before collections are listed so the expansion
 * hook can apply the snapshot synchronously without a post-reveal jump.
 */
export const bootstrapShellForReveal = createAsyncThunk<void, void, ThunkApiConfig>(
  'app/bootstrapShellForReveal',
  async (_, { dispatch, getState }) => {
    // Prefetch expansion early so it is available when collectionsListed flips.
    const sidebarExpansionPromise = window.api.getSidebarExpansion().then((snapshot) => {
      setPrefetchedSidebarExpansion(snapshot);
      return snapshot;
    });

    await Promise.all([
      dispatch(hydrateOpenTabs()),
      dispatch(hydrateTerminalLayout()),
      hydratePanelLayoutFromSettings(dispatch),
      window.api.getGeneralSettings().then((settings) => {
        dispatch(setGeneralSettingsState(settings));
      }),
      window.api.getTheme().then((theme) => applyThemePreference(theme)),
      sidebarExpansionPromise
    ]);

    const expansion = await sidebarExpansionPromise;

    await Promise.all([dispatch(refreshCollections()), dispatch(refreshEnvironments())]);

    const state = getState();
    const collections = state.collections.collections;
    const validIds = new Set(collections.map((collection) => collection.id));
    const draft = selectDraft(state);
    const activeCollectionId = draft.collection_id ?? state.collections.selectedCollectionId;

    const contentIds = new Set<number>();
    if (activeCollectionId != null && validIds.has(activeCollectionId)) {
      contentIds.add(activeCollectionId);
    }
    for (const id of expansion.collectionIds) {
      if (validIds.has(id)) {
        contentIds.add(id);
      }
    }

    await Promise.all([...contentIds].map((id) => dispatch(refreshCollectionContents(id))));

    await dispatch(openSeededBuiltinRequestIfNeeded());
  }
);

/**
 * Waits for storage connections to be available, then refreshes routed entity lists.
 *
 * Live servers, Live Pages, and snippets all fan out across configured providers,
 * so their initial reads must not race provider connection bootstrap.
 *
 * @param dispatch - Redux dispatch used to refresh routed entities.
 */
export async function refreshRoutedStorageEntities(dispatch: AppDispatch): Promise<void> {
  await window.api.listStorageConnections();
  await Promise.all([
    dispatch(refreshSnippets()),
    dispatch(refreshWebsites()),
    dispatch(refreshLiveServers())
  ]);
}

/**
 * Starts non-blocking background loads that are not needed for first paint.
 *
 * @param dispatch - Redux dispatch used to kick off refresh thunks.
 */
export function startBackgroundRefresh(dispatch: AppDispatch): void {
  void refreshRoutedStorageEntities(dispatch);
  void dispatch(refreshRunResults());
  void dispatch(refreshRequestHistory());
  void dispatch(refreshWorkflowRunHistory());
  void dispatch(refreshWorkspaces());
  void dispatch(refreshWorkflows());
  void dispatch(refreshRunningLiveServers());
  void dispatch(refreshTrash());
}
