import {
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  isTabDirty,
  type Tab
} from '#/renderer/src/store/drafts';

/**
 * Builds the accessible name for a tab close button.
 *
 * @param tab - Tab being closed.
 * @param pageTitle - Resolved page tab title when applicable.
 * @returns Label describing which tab the close control dismisses.
 */
export function tabCloseAccessibleName(tab: Tab, pageTitle?: string): string {
  if (isPageTab(tab)) {
    return `Close ${pageTitle ?? 'Page'}`;
  }
  if (isMarkdownTab(tab)) {
    const suffix = isTabDirty(tab) ? ', unsaved' : '';
    return `Close ${tab.name}${suffix}`;
  }
  if (!isRequestTab(tab)) {
    return 'Close tab';
  }
  const suffix = isTabDirty(tab) ? ', unsaved' : '';
  return `Close ${tab.draft.name}${suffix}`;
}
