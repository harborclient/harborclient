import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { buildWebsiteExport } from '@harborclient/core/types/website';
import type { ScriptRef, Snippet } from '@harborclient/core/types';
import type { BrowserInjectionScript } from '#/browser/browserScripts';
import { resolveBrowserHcScriptSources } from '#/browser/browserHcScripts';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { setWebsites } from '#/renderer/src/store/slices/websitesSlice';
import {
  bindBrowserTabToWebsite,
  openBrowserTabFromWebsite,
  openPageTab
} from '#/renderer/src/store/slices/tabsSlice';
import { isBrowserTab, hasBrowserPendingSave } from '#/renderer/src/store/tabs';
import { syncTrash } from '#/renderer/src/store/thunks/trash';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { buildScriptModuleMap } from '#/renderer/src/scripting/scriptResolution';

/**
 * Pushes the browser tab's current scripts to the main-process guest when it exists.
 *
 * @param tabId - Browser tab id.
 * @param tab - Browser tab state with draft scripts to apply.
 * @param snippets - Snippet library for resolving hc.* script sources.
 */
async function pushBrowserTabScriptsToGuest(
  tabId: string,
  tab: {
    scripts: BrowserInjectionScript[];
    pre_request_scripts: ScriptRef[];
    post_request_scripts: ScriptRef[];
  },
  snippets: Snippet[]
): Promise<void> {
  const { modules, conflicts } = buildScriptModuleMap(snippets, [
    tab.pre_request_scripts,
    tab.post_request_scripts
  ]);
  await window.api.browserSetScripts(tabId, tab.scripts, {
    preRequestScripts: resolveBrowserHcScriptSources(tab.pre_request_scripts, snippets),
    postRequestScripts: resolveBrowserHcScriptSources(tab.post_request_scripts, snippets),
    snippetModules: modules,
    snippetModuleConflicts: conflicts
  });
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
      const name = websiteNameFromTab(tab.title, tab.url);
      const items = await window.api.createWebsite({
        uuid,
        name,
        url: tab.url,
        homeUrl: tab.homeUrl,
        faviconDataUrl: tab.faviconDataUrl,
        scripts: tab.scripts,
        preRequestScripts: tab.pre_request_scripts,
        postRequestScripts: tab.post_request_scripts
      });
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
        await pushBrowserTabScriptsToGuest(tabId, tab, snippets);
      } catch {
        // Guest may not exist yet for a background/unmounted tab.
      }
      toast.success('Website saved');
    } catch (error) {
      toast.error(formatErrorMessage(error, 'Failed to save website'));
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
      const name = websiteNameFromTab(tab.title, tab.url);
      const items = await window.api.updateWebsite({
        id: tab.websiteId,
        name,
        url: tab.url,
        homeUrl: tab.homeUrl,
        faviconDataUrl: tab.faviconDataUrl,
        scripts: tab.scripts,
        preRequestScripts: tab.pre_request_scripts,
        postRequestScripts: tab.post_request_scripts
      });
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
        await pushBrowserTabScriptsToGuest(tabId, tab, snippets);
      } catch {
        // Guest may not exist yet for a background/unmounted tab.
      }
      toast.success('Website updated');
    } catch (error) {
      toast.error(formatErrorMessage(error, 'Failed to update website'));
      throw error;
    }
  }
);

/**
 * Saves or updates the active browser tab as a website depending on link state.
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
      toast.error('Website not found');
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
        post_request_scripts: website.postRequestScripts
      })
    );
  }
);

/**
 * Opens a saved website and shows its browser/webpage settings page.
 *
 * Ensures a linked browser tab exists first, then opens the settings page for
 * that tab so injection and hc.* scripts can be edited.
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
    dispatch(
      openPageTab({
        type: 'browser-settings',
        browserTabId: tab.tabId,
        label: 'Browser Settings'
      })
    );
  }
);

/**
 * Moves a website to trash and refreshes the list.
 */
export const deleteWebsite = createAsyncThunk<void, number, ThunkApiConfig>(
  'websites/delete',
  async (id, { dispatch }) => {
    const items = await window.api.deleteWebsite(id);
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
      toast.error('Website not found');
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
      postRequestScripts: website.postRequestScripts
    });
    const saved = await window.api.saveTextFile(
      JSON.stringify(envelope, null, 2),
      `${envelope.name}.json`
    );
    if (saved) {
      toast.success('Website exported');
    }
  }
);
