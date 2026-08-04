import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { closeWebpageTab } from '#/renderer/src/store/browser/webpageSession';
import {
  selectCollections,
  selectEnvironments,
  selectTabs,
  selectActiveTabId
} from '#/renderer/src/store/selectors';
import {
  selectCollectionSettingsDirty,
  selectEnvironmentSettingsDirty,
  selectFolderSettingsDirty,
  selectWorkspaceSettingsDirty
} from '#/renderer/src/store/slices/navigationSlice';
import {
  cancelCollectionRunner,
  closeCollectionRunner
} from '#/renderer/src/store/slices/modalsSlice';
import { selectThemeDesignerIsDirty } from '#/renderer/src/store/slices/themeDesignerSlice';
import { selectWorkspaces } from '#/renderer/src/store/slices/workspaceSlice';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  closeMarkdownTab,
  closeRequestTab,
  patchGeneralSettings
} from '#/renderer/src/store/thunks';
import {
  isBrowserTab,
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  type Tab
} from '#/renderer/src/store/tabs';
import { showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';
import { hasBrowserGuest } from '../BrowserTab/browserGuestRegistry';
import { pageTabCloseName } from '../pageTabCloseHelpers';
import { isDirtyForClose } from './isDirtyForClose';

/**
 * Returns a display name for the unsaved-close confirmation dialog.
 *
 * @param tab - Tab about to close.
 * @param state - Current Redux root state for collection and settings lookups.
 * @returns Human-readable tab name used in the prompt.
 */
function tabClosePromptName(tab: Tab, state: RootState): string {
  if (isMarkdownTab(tab)) {
    return tab.name;
  }

  if (isBrowserTab(tab)) {
    return tab.title || 'Browser';
  }

  if (isRequestTab(tab)) {
    return tab.draft.name;
  }

  if (isPageTab(tab)) {
    if (tab.page.type === 'themes') {
      return 'Themes';
    }

    return pageTabCloseName(
      tab.page,
      selectCollections(state),
      selectEnvironments(state),
      [],
      selectWorkspaces(state)
    );
  }

  return 'Tab';
}

/**
 * Closes one editor tab without prompting, including collection-runner cleanup.
 *
 * @param dispatch - Redux dispatch for tab and modal updates.
 * @param getState - Reads current tabs for browser guest teardown.
 * @param tab - Tab to close.
 */
async function closeEditorTabImmediately(
  dispatch: AppDispatch,
  getState: () => RootState,
  tab: Tab
): Promise<void> {
  const tabId = tab.tabId;

  if (isPageTab(tab)) {
    if (tab.page.type === 'collection-runner') {
      dispatch(cancelCollectionRunner());
      dispatch(closeCollectionRunner());
    }
    dispatch(closeTab(tabId));
    return;
  }

  if (isMarkdownTab(tab)) {
    await dispatch(closeMarkdownTab(tabId));
    return;
  }

  if (isBrowserTab(tab)) {
    const result = await closeWebpageTab({ getState, dispatch }, tabId);
    if ('error' in result) {
      return;
    }
    return;
  }

  await dispatch(closeRequestTab(tabId));
}

/**
 * Closes the active request-editor tab, prompting when it has unsaved changes.
 *
 * Mirrors the tab-bar close button: dirty request, markdown, browser, Themes, and
 * settings page tabs ask for confirmation (with an optional “don’t show again”
 * for request/markdown/browser warnings). No-ops when no tab is active.
 *
 * @param dispatch - Redux dispatch for modals, settings, and tab closes.
 * @param getState - Reads the active tab and dirty flags.
 */
export async function closeActiveEditorTab(
  dispatch: AppDispatch,
  getState: () => RootState
): Promise<void> {
  const state = getState();
  const activeTabId = selectActiveTabId(state);
  if (activeTabId == null || activeTabId === '') {
    return;
  }

  const tab = selectTabs(state).find((entry) => entry.tabId === activeTabId);
  if (tab == null) {
    return;
  }

  const dirty = isDirtyForClose(
    tab,
    activeTabId,
    selectCollectionSettingsDirty(state),
    selectEnvironmentSettingsDirty(state),
    selectFolderSettingsDirty(state),
    selectWorkspaceSettingsDirty(state),
    state.settings.general.warnWhenClosingUnsavedRequests,
    selectThemeDesignerIsDirty(state)
  );

  if (dirty) {
    const browserVisible = isBrowserTab(tab) && hasBrowserGuest(tab.tabId);
    if (browserVisible) {
      await window.api.browserHideAll();
    }

    const result = await showConfirm(dispatch, {
      title: 'Unsaved changes',
      message: `"${tabClosePromptName(tab, state)}" has unsaved changes. Close without saving?`,
      confirmLabel: 'Close without saving',
      checkboxLabel: "Don't show this again"
    });

    if (!result.confirmed) {
      if (browserVisible) {
        await window.api.browserSetVisible(tab.tabId, true);
      }
      return;
    }

    if (result.checkboxChecked) {
      await dispatch(patchGeneralSettings({ warnWhenClosingUnsavedRequests: false }));
    }
  }

  await closeEditorTabImmediately(dispatch, getState, tab);
}
