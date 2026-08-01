import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { buildWebsiteExport } from '@harborclient/core/types/website';
import type { KeyValue, ScriptRef, Snippet, Variable } from '@harborclient/core/types';
import type { AuthConfig } from '@harborclient/core/auth';
import type { BrowserInjectionScript } from '#/browser/browserScripts';
import type { AppDispatch, RootState, ThunkApiConfig } from '#/renderer/src/store/redux';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { setWebsites } from '#/renderer/src/store/slices/websitesSlice';
import { closeLiveServerModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  setActivePluginFooterPanelId,
  setShowConsole,
  setShowLiveServerLogs,
  setShowMcp,
  setShowTerminal,
  setShowVariables
} from '#/renderer/src/store/slices/navigationSlice';
import {
  bindBrowserTabToWebsite,
  newBrowserTab,
  openBrowserTabFromWebsite,
  saveBrowserScripts,
  setBrowserSettingsPanelOpen,
  updateBrowserTab
} from '#/renderer/src/store/slices/tabsSlice';
import { isBrowserTab, hasBrowserPendingSave } from '#/renderer/src/store/tabs';
import { syncTrash } from '#/renderer/src/store/thunks/trash';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { buildBrowserHcScriptsPayload } from '#/renderer/src/store/browser/browserGuestPayload';
import { getActiveBaseVariables } from '#/renderer/src/hooks/useMergedRequestVariables';
import { withOfflineTeamHubLivePageError } from './liveServerThunkErrors';

/**
 * Pushes the browser tab's current scripts and request defaults to the main-process guest.
 *
 * @param tabId - Browser tab id.
 * @param tab - Browser tab state with draft scripts/defaults to apply.
 * @param snippets - Snippet library for resolving hc.* script sources.
 * @param baseVariables - Active collection/environment variables for script seeding.
 */
async function pushBrowserTabScriptsToGuest(
  tabId: string,
  tab: {
    scripts: BrowserInjectionScript[];
    savedScripts: BrowserInjectionScript[];
    pre_request_scripts: ScriptRef[];
    post_request_scripts: ScriptRef[];
    savedPreRequestScripts: ScriptRef[];
    savedPostRequestScripts: ScriptRef[];
    headers: KeyValue[];
    savedHeaders: KeyValue[];
    auth: AuthConfig;
    savedAuth: AuthConfig;
    userAgent: string;
    savedUserAgent: string;
    variables: Variable[];
    savedVariables: Variable[];
    websiteUuid?: string | null;
  },
  snippets: Snippet[],
  baseVariables: Variable[]
): Promise<void> {
  await window.api.browserSetScripts(
    tabId,
    tab.scripts,
    buildBrowserHcScriptsPayload(tab, snippets, baseVariables, false)
  );
}

/**
 * Opens a new Live Page using the Start webpage general setting for url and home.
 *
 * Falls back to about:blank when the setting is empty.
 *
 * @returns Thunk that reads settings and dispatches {@link newBrowserTab}.
 */
export function openNewBrowserTab(): (dispatch: AppDispatch, getState: () => RootState) => void {
  return (dispatch, getState) => {
    const startWebpageUrl = getState().settings.general.startWebpageUrl || 'about:blank';
    dispatch(newBrowserTab({ url: startWebpageUrl, homeUrl: startWebpageUrl }));
  };
}

/**
 * Derives a display name for a website from the browser tab title or URL.
 *
 * Prefers an unsaved settings rename when present; otherwise uses the live document
 * title so Update live page can adopt the current page title.
 *
 * @param tab - Browser tab being saved or updated.
 * @returns Non-empty display name for the website entity.
 */
export function websiteNameFromBrowserTab(tab: {
  settingsName: string;
  savedTitle: string;
  title: string;
  url: string;
}): string {
  const nameSource = tab.settingsName !== tab.savedTitle ? tab.settingsName : tab.title;
  return websiteNameFromTab(nameSource, tab.url);
}

/**
 * Derives a display name for a website from the browser tab title or URL.
 *
 * @param title - Browser tab title.
 * @param url - Browser tab URL.
 * @returns Non-empty display name.
 */
export function websiteNameFromTab(title: string, url: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle && trimmedTitle !== 'New Browser' && trimmedTitle !== 'Browser') {
    return trimmedTitle;
  }
  try {
    const hostname = new URL(url).hostname;
    if (hostname) {
      return hostname;
    }
  } catch {
    // Fall through to default.
  }
  return 'New Browser';
}

/**
 * Reloads websites from the local registry into the store.
 */
export const refreshWebsites = createAsyncThunk<void, void, ThunkApiConfig>(
  'websites/refresh',
  async (_arg, { dispatch }) => {
    const items = await window.api.listWebsites();
    dispatch(setWebsites(items));
  }
);

/**
 * Creates a website from the current browser tab state and binds the tab to it.
 */
export const saveBrowserTabAsWebsite = createAsyncThunk<void, string, ThunkApiConfig>(
  'websites/saveFromTab',
  async (tabId, { dispatch, getState }) => {
    const tab = getState().tabs.tabs.find((item) => item.tabId === tabId);
    if (!tab || !isBrowserTab(tab)) {
      toast.error('Browser tab not found');
      return;
    }
    if (tab.websiteId != null) {
      await dispatch(updateWebsiteFromTab(tabId));
      return;
    }

    try {
      const uuid = crypto.randomUUID();
      const name = websiteNameFromBrowserTab(tab);
      const items = await withOfflineTeamHubLivePageError(() =>
        window.api.createWebsite({
          uuid,
          name,
          url: tab.url,
          homeUrl: tab.homeUrl,
          faviconDataUrl: tab.faviconDataUrl,
          scripts: tab.scripts,
          preRequestScripts: tab.pre_request_scripts,
          postRequestScripts: tab.post_request_scripts,
          variables: tab.variables,
          headers: tab.headers,
          userAgent: tab.userAgent,
          auth: tab.auth
        })
      );
      dispatch(setWebsites(items));
      const created = items.find((item) => item.uuid === uuid);
      if (!created) {
        throw new Error('Website was not created');
      }
      dispatch(
        bindBrowserTabToWebsite({
          tabId,
          websiteId: created.id,
          websiteUuid: created.uuid
        })
      );
      const snippets = selectSnippets(getState());
      try {
        await pushBrowserTabScriptsToGuest(
          tabId,
          tab,
          snippets,
          getActiveBaseVariables(getState())
        );
      } catch {
        // Guest may not exist yet for a background/unmounted tab.
      }
      toast.success('Live page saved');
    } catch (error) {
      toast.error(formatErrorMessage(error, 'Failed to save live page'));
      throw error;
    }
  }
);

/**
 * Updates a linked website from the current browser tab state.
 */
export const updateWebsiteFromTab = createAsyncThunk<void, string, ThunkApiConfig>(
  'websites/updateFromTab',
  async (tabId, { dispatch, getState }) => {
    const tab = getState().tabs.tabs.find((item) => item.tabId === tabId);
    if (!tab || !isBrowserTab(tab) || tab.websiteId == null) {
      toast.error('Saved website not found');
      return;
    }

    try {
      const name = websiteNameFromBrowserTab(tab);
      const websiteId = tab.websiteId;
      const items = await withOfflineTeamHubLivePageError(() =>
        window.api.updateWebsite({
          id: websiteId,
          name,
          url: tab.url,
          homeUrl: tab.homeUrl,
          faviconDataUrl: tab.faviconDataUrl,
          scripts: tab.scripts,
          preRequestScripts: tab.pre_request_scripts,
          postRequestScripts: tab.post_request_scripts,
          variables: tab.variables,
          headers: tab.headers,
          userAgent: tab.userAgent,
          auth: tab.auth
        })
      );
      dispatch(setWebsites(items));
      dispatch(
        bindBrowserTabToWebsite({
          tabId,
          websiteId: tab.websiteId,
          websiteUuid:
            tab.websiteUuid ?? items.find((item) => item.id === tab.websiteId)?.uuid ?? ''
        })
      );
      const snippets = selectSnippets(getState());
      try {
        await pushBrowserTabScriptsToGuest(
          tabId,
          tab,
          snippets,
          getActiveBaseVariables(getState())
        );
      } catch {
        // Guest may not exist yet for a background/unmounted tab.
      }
      toast.success('Live page updated');
    } catch (error) {
      toast.error(formatErrorMessage(error, 'Failed to update live page'));
      throw error;
    }
  }
);

/**
 * Saves or updates the active browser tab as a website depending on link state.
 *
 * Always shows a success toast when the chrome Save control is used: first create,
 * update with pending changes, or a no-op click on an already-saved live page.
 */
export const saveOrUpdateBrowserWebsite = createAsyncThunk<void, string, ThunkApiConfig>(
  'websites/saveOrUpdateFromTab',
  async (tabId, { dispatch, getState }) => {
    const tab = getState().tabs.tabs.find((item) => item.tabId === tabId);
    if (!tab || !isBrowserTab(tab)) {
      return;
    }
    if (tab.websiteId != null) {
      if (!hasBrowserPendingSave(tab)) {
        toast.success('Live page saved');
        return;
      }
      await dispatch(updateWebsiteFromTab(tabId));
      return;
    }
    await dispatch(saveBrowserTabAsWebsite(tabId));
  }
);

/**
 * Opens a saved website in a browser tab (or focuses an already-open linked tab).
 */
export const openWebsite = createAsyncThunk<void, number, ThunkApiConfig>(
  'websites/open',
  async (id, { dispatch, getState }) => {
    const website = getState().websites.items.find((item) => item.id === id);
    if (!website) {
      toast.error('Live page not found');
      return;
    }

    dispatch(
      openBrowserTabFromWebsite({
        websiteId: website.id,
        websiteUuid: website.uuid,
        title: website.name,
        url: website.url,
        homeUrl: website.homeUrl,
        faviconDataUrl: website.faviconDataUrl,
        scripts: website.scripts,
        pre_request_scripts: website.preRequestScripts,
        post_request_scripts: website.postRequestScripts,
        variables: website.variables,
        headers: website.headers,
        userAgent: website.userAgent,
        auth: website.auth
      })
    );
  }
);

/**
 * Opens a saved website and shows its live page settings footer panel.
 *
 * Ensures a linked browser tab exists first, closes other footer panels (same
 * mutual exclusivity as the live server editor), then opens the settings panel
 * so injection and hc.* scripts can be edited.
 *
 * @param id - Saved website id.
 */
export const openWebsiteSettings = createAsyncThunk<void, number, ThunkApiConfig>(
  'websites/openSettings',
  async (id, { dispatch, getState }) => {
    await dispatch(openWebsite(id));
    const tab = getState().tabs.tabs.find((item) => isBrowserTab(item) && item.websiteId === id);
    if (!tab || !isBrowserTab(tab)) {
      return;
    }
    dispatch(setShowConsole(false));
    dispatch(setShowVariables(false));
    dispatch(setShowMcp(false));
    dispatch(setShowTerminal(false));
    if (getState().navigation.liveServerLogsPlacement === 'footer') {
      dispatch(setShowLiveServerLogs(false));
    }
    dispatch(setActivePluginFooterPanelId(null));
    dispatch(closeLiveServerModal());
    dispatch(setBrowserSettingsPanelOpen({ tabId: tab.tabId, open: true }));
  }
);

/**
 * Input for saving live page settings from the settings form.
 */
export interface SaveLivePageSettingsInput {
  /**
   * Browser tab id whose draft settings are being saved.
   */
  tabId: string;

  /**
   * Display name for the live page / tab title.
   */
  name: string;

  /**
   * Website-scoped variables.
   */
  variables: Variable[];

  /**
   * Headers for chrome-driven navigations.
   */
  headers: KeyValue[];

  /**
   * User-Agent override.
   */
  userAgent: string;

  /**
   * Authorization settings.
   */
  auth: AuthConfig;

  /**
   * Pre-request hc.* scripts.
   */
  preRequestScripts: ScriptRef[];

  /**
   * Post-request hc.* scripts.
   */
  postRequestScripts: ScriptRef[];

  /**
   * Injection scripts.
   */
  scripts: BrowserInjectionScript[];

  /**
   * Destination storage connection selected in General settings.
   */
  connectionId?: string;
}

/**
 * Saves live page settings: syncs the browser tab + guest, and writes the Website
 * registry when the tab is linked.
 *
 * @param input - Cleaned settings fields from the settings form.
 */
export const saveLivePageSettings = createAsyncThunk<
  void,
  SaveLivePageSettingsInput,
  ThunkApiConfig
>('websites/saveLivePageSettings', async (input, { dispatch, getState }) => {
  const tab = getState().tabs.tabs.find((item) => item.tabId === input.tabId);
  if (!tab || !isBrowserTab(tab)) {
    toast.error('Browser tab not found');
    throw new Error('Browser tab not found');
  }

  dispatch(
    updateBrowserTab({
      tabId: input.tabId,
      updates: {
        settingsName: input.name,
        title: input.name,
        variables: input.variables,
        headers: input.headers,
        userAgent: input.userAgent,
        auth: input.auth,
        pre_request_scripts: input.preRequestScripts,
        post_request_scripts: input.postRequestScripts,
        scripts: input.scripts
      }
    })
  );
  dispatch(saveBrowserScripts(input.tabId));

  const updated = getState().tabs.tabs.find((item) => item.tabId === input.tabId);
  if (!updated || !isBrowserTab(updated)) {
    throw new Error('Browser tab not found after save');
  }

  const snippets = selectSnippets(getState());
  try {
    await pushBrowserTabScriptsToGuest(
      input.tabId,
      updated,
      snippets,
      getActiveBaseVariables(getState())
    );
  } catch {
    // Guest may not exist yet for a background/unmounted tab.
  }

  if (updated.websiteId != null) {
    const websiteId = updated.websiteId;
    const website = getState().websites.items.find((item) => item.id === websiteId);
    const primaryConnectionId =
      (await Promise.resolve(window.api.getActiveStorageId()).catch(() => '')) || '';
    const currentConnectionId = website?.connectionId ?? primaryConnectionId;
    if (input.connectionId && input.connectionId !== currentConnectionId) {
      await withOfflineTeamHubLivePageError(() =>
        window.api.moveWebsite(websiteId, input.connectionId as string)
      );
    }

    let items;
    try {
      items = await withOfflineTeamHubLivePageError(() =>
        window.api.updateWebsite({
          id: websiteId,
          name: input.name,
          url: updated.url,
          homeUrl: updated.homeUrl,
          faviconDataUrl: updated.faviconDataUrl,
          scripts: updated.scripts,
          preRequestScripts: updated.pre_request_scripts,
          postRequestScripts: updated.post_request_scripts,
          variables: updated.variables,
          headers: updated.headers,
          userAgent: updated.userAgent,
          auth: updated.auth
        })
      );
    } catch (err) {
      if (input.connectionId && input.connectionId !== currentConnectionId) {
        const refreshed = await window.api.listWebsites();
        dispatch(setWebsites(refreshed));
        throw new Error(
          'Live page was moved to the new database, but your changes could not be saved. Open it again and save.',
          { cause: err }
        );
      }
      throw err;
    }
    dispatch(setWebsites(items));
    dispatch(
      bindBrowserTabToWebsite({
        tabId: input.tabId,
        websiteId: updated.websiteId,
        websiteUuid:
          updated.websiteUuid ?? items.find((item) => item.id === updated.websiteId)?.uuid ?? ''
      })
    );
  }

  toast.success('Live page settings saved');
});

/**
 * Moves a website to trash and refreshes the list.
 */
export const deleteWebsite = createAsyncThunk<void, number, ThunkApiConfig>(
  'websites/delete',
  async (id, { dispatch }) => {
    const items = await withOfflineTeamHubLivePageError(() => window.api.deleteWebsite(id));
    dispatch(setWebsites(items));
    await syncTrash(dispatch);
  }
);

/**
 * Exports a website as a HarborClient JSON file via the save dialog.
 */
export const exportWebsite = createAsyncThunk<void, number, ThunkApiConfig>(
  'websites/export',
  async (id, { getState }) => {
    const website = getState().websites.items.find((item) => item.id === id);
    if (!website) {
      toast.error('Live page not found');
      return;
    }

    const envelope = buildWebsiteExport({
      uuid: website.uuid,
      name: website.name,
      url: website.url,
      homeUrl: website.homeUrl,
      faviconDataUrl: website.faviconDataUrl,
      scripts: website.scripts,
      preRequestScripts: website.preRequestScripts,
      postRequestScripts: website.postRequestScripts,
      variables: website.variables,
      headers: website.headers,
      userAgent: website.userAgent,
      auth: website.auth
    });
    const saved = await window.api.saveTextFile(
      JSON.stringify(envelope, null, 2),
      `${envelope.name}.json`
    );
    if (saved) {
      toast.success('Live page exported');
    }
  }
);
