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
 * @param dirty - Whether the tab has unsaved changes (page tabs such as Themes).
 * @returns Label describing which tab the close control dismisses.
 */
export function tabCloseAccessibleName(tab: Tab, pageTitle?: string, dirty = false): string {
  if (isPageTab(tab)) {
    const suffix = dirty ? ', unsaved' : '';
    return `Close ${pageTitle ?? 'Page'}${suffix}`;
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
