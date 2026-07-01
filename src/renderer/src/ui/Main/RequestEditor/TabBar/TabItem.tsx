import { FaIcon, Spinner, TabCloseButton } from '@harborclient/sdk/components';
import { METHOD_CLASSES, requestTabItem } from '#/renderer/src/ui/shared/classes';
import type { JSX, KeyboardEvent } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { isPageTab, isRequestTab, isTabDirty, type Tab } from '#/renderer/src/store/drafts';

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
   * Roving tabindex for the tab control: `0` when selected, `-1` otherwise.
   */
  tabIndex: number;

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
 * Single tab with request method badge or page icon, dirty indicator, and close button.
 */
export function TabItem({
  tab,
  active,
  tabIndex,
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

  return (
    <div
      role="tab"
      id={`request-tab-${tab.tabId}`}
      aria-controls={`request-tabpanel-${tab.tabId}`}
      aria-selected={active}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      className={`group -mb-1 flex max-w-[220px] min-h-12 shrink-0 cursor-pointer self-stretch items-stretch gap-1.5 rounded-t-md border border-b-0 px-4 ${requestTabItem(active)}`}
      onClick={() => onSelect(tab.tabId)}
      onKeyDown={handleTabKeyDown}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-inherit app-no-drag">
        {isPage ? (
          pageIcon && <FaIcon icon={pageIcon} className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <>
            <span
              className={`shrink-0 px-1 py-px text-[14px] ${METHOD_CLASSES[tab.draft.method.toLowerCase()] ?? 'text-info'}`}
            >
              {tab.draft.method}
            </span>
            {tab.sending && <Spinner size="sm" label="Sending…" className="h-3.5 w-3.5 shrink-0" />}
            {isTabDirty(tab) && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted" aria-hidden="true" />
            )}
          </>
        )}
        <span className="truncate text-[14px]">
          {isPage ? (pageTitle ?? 'Page') : tab.draft.name}
        </span>
      </span>
      <TabCloseButton
        ariaLabel="Close tab"
        onClick={(event) => {
          event.stopPropagation();
          onClose(tab.tabId);
        }}
      />
    </div>
  );
}
