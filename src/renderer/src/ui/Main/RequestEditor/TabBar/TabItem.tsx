import { FaIcon, Spinner, TabCloseButton } from '@harborclient/sdk/components';
import { METHOD_CLASSES, requestTabItem } from '#/renderer/src/ui/shared/classes';
import { useSortableTabItem } from '#/renderer/src/ui/shared/useSortableTabItem';
import type { JSX, KeyboardEvent } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { isPageTab, isRequestTab, isTabDirty, type Tab } from '#/renderer/src/store/drafts';
import { tabCloseAccessibleName } from './tabCloseAccessibleName';

interface Props {
  /**
   * Tab data to render.
   */
  tab: Tab;

  /**
   * Whether this tab is the currently selected tab.
   */
  active: boolean;

  /**
   * Tab order index for the tab label; all tabs stay in sequential Tab order.
   */
  tabIndex: number;

  /**
   * Stable dnd-kit sortable id for this tab row.
   */
  sortableId: string;

  /**
   * When true, drag reordering is disabled for this tab.
   */
  sortableDisabled?: boolean;

  /**
   * Display title for page tabs (resolved from entity names when applicable).
   */
  pageTitle?: string;

  /**
   * Icon for page tabs.
   */
  pageIcon?: IconDefinition;

  /**
   * Called when the user selects this tab.
   *
   * @param tabId - Tab to activate.
   */
  onSelect: (tabId: string) => void;

  /**
   * Called when the user closes this tab.
   *
   * @param tabId - Tab to close.
   */
  onClose: (tabId: string) => void;
}

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
 * Builds the accessible name for a page tab.
 *
 * @param title - Resolved page tab title.
 * @returns Accessible label for screen readers.
 */
function pageTabAccessibleName(title: string): string {
  return title;
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
  if (isRequestTab(tab)) {
    return tab.draft.name;
  }
  return 'Tab';
}

/**
 * Single tab with request method badge or page icon, unsaved dot (left of method), and close button.
 */
export function TabItem({
  tab,
  active,
  tabIndex,
  sortableId,
  sortableDisabled = false,
  pageTitle,
  pageIcon,
  onSelect,
  onClose
}: Props): JSX.Element {
  /**
   * Activates this tab when the user presses Enter or Space on the tab control.
   *
   * @param event - Keyboard event from the tab element.
   */
  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(tab.tabId);
    }
  };

  const isPage = isPageTab(tab);
  const ariaLabel = isPage
    ? pageTabAccessibleName(pageTitle ?? 'Page')
    : requestTabAccessibleName(tab);
  const closeLabel = tabCloseAccessibleName(tab, pageTitle);
  const title = documentTabTitle(tab, pageTitle);
  const { setNodeRef, listeners, style } = useSortableTabItem(sortableId, sortableDisabled);

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="tab"
      id={`request-tab-${tab.tabId}`}
      aria-controls={`request-tabpanel-${tab.tabId}`}
      aria-selected={active}
      aria-label={ariaLabel}
      title={title}
      tabIndex={tabIndex}
      className={`group -mb-1 flex max-w-[220px] min-h-12 shrink-0 self-stretch items-stretch gap-2.5 rounded-t-lg border border-b-0 px-4 ${requestTabItem(active)} ${sortableDisabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
      onClick={() => onSelect(tab.tabId)}
      onKeyDown={handleTabKeyDown}
      {...(sortableDisabled ? {} : listeners)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-inherit app-no-drag">
        {isPage ? (
          pageIcon && <FaIcon icon={pageIcon} className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <>
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${isTabDirty(tab) ? 'bg-accent' : 'bg-transparent'}`}
              aria-hidden="true"
            />
            <span
              className={`shrink-0 px-1 py-px text-[14px] ${METHOD_CLASSES[tab.draft.method.toLowerCase()] ?? 'text-info'}`}
            >
              {tab.draft.method}
            </span>
            {tab.sending && <Spinner size="sm" label="Sending…" className="h-3.5 w-3.5 shrink-0" />}
          </>
        )}
        <span className={`truncate text-[14px] ${isPage && pageIcon ? 'ms-1.5' : ''}`}>
          {isPage ? (pageTitle ?? 'Page') : tab.draft.name}
        </span>
      </span>
      <span
        className="flex shrink-0 items-center self-center app-no-drag"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <TabCloseButton
          ariaLabel={closeLabel}
          title={closeLabel}
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onClose(tab.tabId);
          }}
        />
      </span>
    </div>
  );
}
