import {
  isBrowserTab,
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  isTabDirty,
  type Tab
} from '#/renderer/src/store/tabs';
import { isActivePageTabDirty } from '../pageTabCloseHelpers';

/**
 * Returns whether closing a tab should prompt for unsaved changes.
 *
 * @param tab - Open tab being evaluated.
 * @param activeTabId - Currently selected tab id.
 * @param collectionSettingsDirty - Whether collection settings have unsaved edits.
 * @param environmentSettingsDirty - Whether environment settings have unsaved edits.
 * @param folderSettingsDirty - Whether folder settings have unsaved edits.
 * @param workspaceSettingsDirty - Whether workspace settings have unsaved edits.
 * @param warnWhenClosingUnsavedRequests - Whether request-tab close prompts are enabled.
 * @param themeDesignerDirty - Whether the Theme Designer has unsaved edits.
 * @returns True when the close action should ask for confirmation.
 */
export function isDirtyForClose(
  tab: Tab,
  activeTabId: string,
  collectionSettingsDirty: boolean,
  environmentSettingsDirty: boolean,
  folderSettingsDirty: boolean,
  workspaceSettingsDirty: boolean,
  warnWhenClosingUnsavedRequests: boolean,
  themeDesignerDirty: boolean
): boolean {
  if (isMarkdownTab(tab)) {
    return warnWhenClosingUnsavedRequests && isTabDirty(tab);
  }

  if (isBrowserTab(tab)) {
    return warnWhenClosingUnsavedRequests && isTabDirty(tab);
  }

  if (isRequestTab(tab)) {
    return warnWhenClosingUnsavedRequests && isTabDirty(tab);
  }

  if (isPageTab(tab) && tab.page.type === 'themes') {
    return themeDesignerDirty;
  }

  if (isPageTab(tab) && (tab.page.type === 'collection' || tab.page.type === 'folder')) {
    if (isTabDirty(tab)) {
      return true;
    }
    if (tab.tabId !== activeTabId) {
      return false;
    }
    return isActivePageTabDirty(
      tab.page,
      collectionSettingsDirty,
      environmentSettingsDirty,
      folderSettingsDirty,
      workspaceSettingsDirty
    );
  }

  if (isPageTab(tab) && tab.tabId === activeTabId) {
    return isActivePageTabDirty(
      tab.page,
      collectionSettingsDirty,
      environmentSettingsDirty,
      folderSettingsDirty,
      workspaceSettingsDirty
    );
  }

  return false;
}
