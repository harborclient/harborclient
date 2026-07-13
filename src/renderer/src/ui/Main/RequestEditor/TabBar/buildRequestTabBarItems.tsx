import { type TabBarItem } from '@harborclient/sdk/components';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  isTabDirty,
  type Tab
} from '#/renderer/src/store/drafts';
import { tabCloseAccessibleName } from './tabCloseAccessibleName';
import { RequestTabContent } from './RequestTabContent';

/**
 * Builds the accessible name for a request tab, including unsaved state.
 *
 * @param tab - Request tab whose label is composed for screen readers.
 * @returns Comma-separated method, name, and optional unsaved suffix.
 */
function requestTabAccessibleName(tab: Tab): string {
  if (!isRequestTab(tab)) {
    return '';
  }
  const parts = [tab.draft.method, tab.draft.name];
  if (isTabDirty(tab)) parts.push('unsaved');
  return parts.join(', ');
}

/**
 * Builds the accessible name for a markdown document tab.
 *
 * @param tab - Markdown tab whose label is composed for screen readers.
 * @returns File name and optional unsaved suffix.
 */
function markdownTabAccessibleName(tab: Tab): string {
  if (!isMarkdownTab(tab)) {
    return '';
  }
  const parts = [tab.name];
  if (isTabDirty(tab)) parts.push('unsaved');
  return parts.join(', ');
}

/**
 * Builds the accessible name for a page tab.
 *
 * @param title - Resolved page tab title.
 * @param dirty - Whether the page tab has unsaved changes.
 * @returns Accessible label for screen readers.
 */
function pageTabAccessibleName(title: string, dirty: boolean): string {
  const parts = [title];
  if (dirty) {
    parts.push('unsaved');
  }
  return parts.join(', ');
}

/**
 * Native tooltip text showing the full tab title when the label is truncated.
 *
 * @param tab - Open editor tab.
 * @param pageTitle - Resolved page tab title, when applicable.
 * @returns Full display name for the tab label.
 */
function documentTabTitle(tab: Tab, pageTitle?: string): string {
  if (isPageTab(tab)) {
    return pageTitle ?? 'Page';
  }
  if (isMarkdownTab(tab)) {
    return tab.name;
  }
  if (isRequestTab(tab)) {
    return tab.draft.name;
  }
  return 'Tab';
}

/**
 * Resolves overlay preview text for a dragged request editor tab.
 *
 * @param tab - Tab being dragged.
 * @param pageTitle - Resolved page tab title, when applicable.
 */
function requestTabDragLabel(tab: Tab, pageTitle?: string): string {
  if (isPageTab(tab)) {
    return pageTitle ?? 'Page';
  }
  if (isRequestTab(tab)) {
    return `${tab.draft.method} ${tab.draft.name}`;
  }
  return 'Tab';
}

interface BuildItemsOptions {
  /**
   * Open tabs to map into SDK tab bar items.
   */
  tabs: Tab[];

  /**
   * ID of the currently active tab.
   */
  activeTabId: string;

  /**
   * Resolved page tab metadata keyed by tab id.
   */
  pageTabDisplays: Map<string, { title: string; icon?: IconDefinition }>;

  /**
   * Whether matching saved request tabs should use active styling during tab group edit.
   */
  highlightedTabIds?: ReadonlySet<string>;

  /**
   * Whether the Theme Designer has unsaved edits (Themes page tab indicator).
   */
  themeDesignerDirty: boolean;
}

/**
 * Maps open request editor tabs into SDK {@link TabBarItem} rows.
 *
 * @param options - Tab list, active id, and resolved page metadata.
 * @returns Tab bar items for the shared SDK TabBar component.
 */
export function buildRequestTabBarItems({
  tabs,
  activeTabId,
  pageTabDisplays,
  highlightedTabIds,
  themeDesignerDirty
}: BuildItemsOptions): TabBarItem<string>[] {
  return tabs.map((tab) => {
    const pageDisplay = pageTabDisplays.get(tab.tabId);
    const pageTitle = pageDisplay?.title;
    const isPage = isPageTab(tab);
    const isMarkdown = isMarkdownTab(tab);
    const dirty = isPage ? tab.page.type === 'themes' && themeDesignerDirty : isTabDirty(tab);
    const ariaLabel = isPage
      ? pageTabAccessibleName(pageTitle ?? 'Page', dirty)
      : isMarkdown
        ? markdownTabAccessibleName(tab)
        : requestTabAccessibleName(tab);

    return {
      id: tab.tabId,
      active: tab.tabId === activeTabId,
      highlighted: highlightedTabIds?.has(tab.tabId),
      accessibleName: ariaLabel,
      closeAccessibleName: tabCloseAccessibleName(tab, pageTitle, dirty),
      title: documentTabTitle(tab, pageTitle),
      dragLabel: requestTabDragLabel(tab, pageTitle),
      content: (
        <RequestTabContent
          tab={tab}
          pageTitle={pageTitle}
          pageIcon={pageDisplay?.icon}
          dirty={dirty}
        />
      )
    };
  });
}
