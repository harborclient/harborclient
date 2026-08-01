import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { buildWebsiteExport } from '@harborclient/core/types/website';
import type { KeyValue, ScriptRef, Snippet, Variable, Website } from '@harborclient/core/types';
import type { AuthConfig } from '@harborclient/core/auth';
import type { BrowserInjectionScript } from '#/browser/browserScripts';
import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import type { AppDispatch, RootState, ThunkApiConfig } from '#/renderer/src/store/redux';
import { selectActiveBrowserTab, selectSnippets } from '#/renderer/src/store/selectors';
import { setWebsites } from '#/renderer/src/store/slices/websitesSlice';
import {
  closeAddLivePageModal,
  closeLiveServerModal,
  openAddLivePageModal,
  type AddLivePageModalTab
} from '#/renderer/src/store/slices/modalsSlice';
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
  openBrowserTabFromWebsite,
  saveBrowserScripts,
  setBrowserSettingsPanelOpen,
  updateBrowserTab
} from '#/renderer/src/store/slices/tabsSlice';
import { isBrowserTab } from '#/renderer/src/store/tabs';
import { syncTrash } from '#/renderer/src/store/thunks/trash';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { buildBrowserHcScriptsPayload } from '#/renderer/src/store/browser/browserGuestPayload';
import { getActiveBaseVariables } from '#/renderer/src/hooks/useMergedRequestVariables';
import { withOfflineTeamHubLivePageError } from './liveServerThunkErrors';

/**
 * Website ids with an in-flight favicon persist so navigation events do not stack writes.
 */
const faviconPersistInFlight = new Set<number>();

/**
 * Returns true when a browser URL should be treated as empty for modal prefill.
 *
 * @param url - Candidate URL from the focused browser tab.
 */
function isBlankBrowserUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.length === 0 || trimmed === 'about:blank';
}

/**
 * Returns whether a tab favicon is safe to attach to a live page for the given URL.
 *
 * Favicons are origin-scoped; only reuse the tab icon when both URLs share an http(s) origin.
 *
 * @param tabUrl - URL that produced the favicon.
 * @param pageUrl - Live page URL that would store the favicon.
 */
export function canReuseTabFaviconForUrl(tabUrl: string, pageUrl: string): boolean {
  try {
    const tab = new URL(tabUrl);
    const page = new URL(pageUrl);
    if (
      (tab.protocol !== 'http:' && tab.protocol !== 'https:') ||
      (page.protocol !== 'http:' && page.protocol !== 'https:')
    ) {
      return false;
    }
    return tab.origin === page.origin;
  } catch {
    return false;
  }
}

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
 * Opens the Add Live Page modal, prefilling name/url from the focused browser tab when present.
 *
 * Blank / about:blank URLs are left empty so the user can enter a destination.
 *
 * @param options - Optional initial segmented tab.
 * @returns Thunk that reads the active browser tab and opens the modal.
 */
export function openAddLivePageModalWithPrefill(options?: {
  tab?: AddLivePageModalTab;
}): (dispatch: Dispatch<UnknownAction>, getState: () => RootState) => void {
  return (dispatch, getState) => {
    const browserTab = selectActiveBrowserTab(getState());
    let name = '';
    let url = '';
    if (browserTab) {
      name = websiteNameFromBrowserTab(browserTab);
      url = isBlankBrowserUrl(browserTab.url) ? '' : browserTab.url;
    }
    dispatch(
      openAddLivePageModal({
        tab: options?.tab,
        name,
        url
      })
    );
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
 * Input for creating a live page from the Add Live Page modal.
 */
export interface CreateLivePageFromModalInput {
  /**
   * Display name for the live page.
   */
  name: string;

  /**
   * Start URL (also used as home URL).
   */
  url: string;

  /**
   * Destination storage connection id.
   */
  connectionId?: string;
}

/**
 * Creates a live page from the Add Live Page modal and opens or binds a browser tab.
 *
 * When the focused tab is an unlinked browser tab, binds that tab instead of opening another.
 *
 * @returns The created website.
 */
export const createLivePageFromModal = createAsyncThunk<
  Website,
  CreateLivePageFromModalInput,
  ThunkApiConfig
>('websites/createFromModal', async (input, { dispatch, getState }) => {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Name is required');
  }
  const url = input.url.trim() || 'about:blank';
  const homeUrl = url;
  const sourceTab = selectActiveBrowserTab(getState());
  const bindSource = sourceTab != null && sourceTab.websiteId == null ? sourceTab : null;
  const faviconDataUrl =
    bindSource?.faviconDataUrl != null &&
    bindSource.faviconDataUrl.length > 0 &&
    canReuseTabFaviconForUrl(bindSource.url, url)
      ? bindSource.faviconDataUrl
      : null;

  const uuid = crypto.randomUUID();
  const items = await withOfflineTeamHubLivePageError(() =>
    window.api.createWebsite({
      uuid,
      name,
      url,
      homeUrl,
      connectionId: input.connectionId,
      faviconDataUrl,
      scripts: bindSource?.scripts,
      preRequestScripts: bindSource?.pre_request_scripts,
      postRequestScripts: bindSource?.post_request_scripts,
      variables: bindSource?.variables,
      headers: bindSource?.headers,
      userAgent: bindSource?.userAgent,
      auth: bindSource?.auth
    })
  );
  dispatch(setWebsites(items));
  const created = items.find((item) => item.uuid === uuid);
  if (!created) {
    throw new Error('Live page was not created');
  }

  if (bindSource) {
    const previousUrl = bindSource.url;
    dispatch(
      updateBrowserTab({
        tabId: bindSource.tabId,
        updates: {
          title: name,
          settingsName: name,
          url,
          homeUrl
        }
      })
    );
    dispatch(
      bindBrowserTabToWebsite({
        tabId: bindSource.tabId,
        websiteId: created.id,
        websiteUuid: created.uuid
      })
    );
    if (url !== previousUrl) {
      try {
        await window.api.browserLoadURL(bindSource.tabId, url);
      } catch {
        // Guest may not exist yet for a background/unmounted tab.
      }
    }
    const snippets = selectSnippets(getState());
    const updated = getState().tabs.tabs.find((item) => item.tabId === bindSource.tabId);
    if (updated && isBrowserTab(updated)) {
      try {
        await pushBrowserTabScriptsToGuest(
          bindSource.tabId,
          updated,
          snippets,
          getActiveBaseVariables(getState())
        );
      } catch {
        // Guest may not exist yet for a background/unmounted tab.
      }
    }
  } else {
    await dispatch(openWebsite(created.id));
  }

  toast.success('Live page created');
  return created;
});

/**
 * Imports a HarborClient live-page export via the native file dialog.
 *
 * @returns The imported or updated website, or null when the dialog was canceled.
 */
export const importWebsite = createAsyncThunk<Website | null, void, ThunkApiConfig>(
  'websites/import',
  async (_arg, { dispatch }) => {
    const website = await window.api.importWebsite();
    if (!website) {
      return null;
    }
    await dispatch(refreshWebsites());
    dispatch(closeAddLivePageModal());
    return website;
  }
);

/**
 * Quietly persists a resolved favicon onto a linked live page when navigation provides one.
 *
 * Live pages are often saved before Chromium finishes favicon resolution. Once the guest
 * reports a favicon for the saved page origin, write it to the website registry so the
 * sidebar can show the site icon without requiring another manual save.
 *
 * @param tabId - Browser tab that reported navigation state.
 * @param faviconDataUrl - Resolved favicon data URL, or null when cleared.
 * @returns Thunk that may schedule a best-effort website favicon update.
 */
export function maybePersistWebsiteFaviconFromNavigation(
  tabId: string,
  faviconDataUrl: string | null
): (dispatch: AppDispatch, getState: () => RootState) => void {
  return (dispatch, getState) => {
    if (faviconDataUrl == null || faviconDataUrl.length === 0) {
      return;
    }

    const state = getState();
    const tab = state.tabs.tabs.find((item) => item.tabId === tabId);
    if (!tab || !isBrowserTab(tab) || tab.websiteId == null) {
      return;
    }

    const website = state.websites.items.find((item) => item.id === tab.websiteId);
    if (!website || website.faviconDataUrl === faviconDataUrl) {
      return;
    }

    const onSavedOrigin =
      canReuseTabFaviconForUrl(tab.url, website.url) ||
      canReuseTabFaviconForUrl(tab.url, website.homeUrl);
    if (!onSavedOrigin) {
      return;
    }

    const websiteId = website.id;
    if (faviconPersistInFlight.has(websiteId)) {
      return;
    }
    faviconPersistInFlight.add(websiteId);

    void (async (): Promise<void> => {
      try {
        const items = await window.api.updateWebsite({
          id: websiteId,
          name: website.name,
          url: website.url,
          homeUrl: website.homeUrl,
          faviconDataUrl,
          scripts: website.scripts,
          preRequestScripts: website.preRequestScripts,
          postRequestScripts: website.postRequestScripts,
          variables: website.variables,
          headers: website.headers,
          userAgent: website.userAgent,
          auth: website.auth
        });
        dispatch(setWebsites(items));
        const linkedTabs = getState().tabs.tabs.filter(
          (item) => isBrowserTab(item) && item.websiteId === websiteId
        );
        for (const linked of linkedTabs) {
          if (!isBrowserTab(linked) || linked.faviconDataUrl !== faviconDataUrl) {
            continue;
          }
          dispatch(
            updateBrowserTab({
              tabId: linked.tabId,
              updates: { savedFaviconDataUrl: faviconDataUrl }
            })
          );
        }
      } catch {
        // Best-effort background sync; the open tab favicon still renders in the sidebar.
      } finally {
        faviconPersistInFlight.delete(websiteId);
      }
    })();
  };
}

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
 * Shows the live page settings footer panel for a saved website.
 *
 * Ensures a linked browser tab exists as the draft host (without activating it,
 * so the editor does not switch to the live page), closes other footer panels
 * (same mutual exclusivity as the live server editor), then opens the settings
 * panel so injection and hc.* scripts can be edited.
 *
 * @param id - Saved website id.
 */
export const openWebsiteSettings = createAsyncThunk<void, number, ThunkApiConfig>(
  'websites/openSettings',
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
        auth: website.auth,
        activate: false
      })
    );

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
    for (const openTab of getState().tabs.tabs) {
      if (isBrowserTab(openTab) && openTab.settingsPanelOpen && openTab.tabId !== tab.tabId) {
        dispatch(setBrowserSettingsPanelOpen({ tabId: openTab.tabId, open: false }));
      }
    }
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
