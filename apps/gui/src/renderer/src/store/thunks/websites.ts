import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { buildWebsiteExport } from '@harborclient/core/types/website';
import type { KeyValue, ScriptRef, Snippet, Variable } from '@harborclient/core/types';
import type { AuthConfig } from '@harborclient/core/auth';
import type { BrowserInjectionScript } from '#/browser/browserScripts';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { setWebsites } from '#/renderer/src/store/slices/websitesSlice';
import {
  bindBrowserTabToWebsite,
  openBrowserTabFromWebsite,
  openPageTab,
  saveBrowserScripts,
  updateBrowserTab
} from '#/renderer/src/store/slices/tabsSlice';
import { isBrowserTab, hasBrowserPendingSave } from '#/renderer/src/store/tabs';
import { syncTrash } from '#/renderer/src/store/thunks/trash';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { buildBrowserHcScriptsPayload } from '#/renderer/src/store/browser/browserGuestPayload';

/**
 * Pushes the browser tab's current scripts and request defaults to the main-process guest.
 *
 * @param tabId - Browser tab id.
 * @param tab - Browser tab state with draft scripts/defaults to apply.
 * @param snippets - Snippet library for resolving hc.* script sources.
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
    headers: import('@harborclient/core/types').KeyValue[];
    savedHeaders: import('@harborclient/core/types').KeyValue[];
    auth: import('@harborclient/core/auth').AuthConfig;
    savedAuth: import('@harborclient/core/auth').AuthConfig;
    userAgent: string;
    savedUserAgent: string;
  },
  snippets: Snippet[]
): Promise<void> {
  await window.api.browserSetScripts(
    tabId,
    tab.scripts,
    buildBrowserHcScriptsPayload(tab, snippets, false)
  );
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
        postRequestScripts: tab.post_request_scripts,
        variables: tab.variables,
        headers: tab.headers,
        userAgent: tab.userAgent,
        auth: tab.auth
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
      const name = websiteNameFromTab(tab.title, tab.url);
      const items = await window.api.updateWebsite({
        id: tab.websiteId,
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
      toast.success('Live page updated');
    } catch (error) {
      toast.error(formatErrorMessage(error, 'Failed to update live page'));
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
        label: 'Live Page Settings'
      })
    );
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
    await pushBrowserTabScriptsToGuest(input.tabId, updated, snippets);
  } catch {
    // Guest may not exist yet for a background/unmounted tab.
  }

  if (updated.websiteId != null) {
    const items = await window.api.updateWebsite({
      id: updated.websiteId,
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
    });
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
