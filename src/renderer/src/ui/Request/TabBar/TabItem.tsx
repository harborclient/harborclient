import type { JSX, KeyboardEvent } from 'react';
import type { RequestTab } from '#/renderer/src/store/drafts';
import { isTabDirty } from '#/renderer/src/store/drafts';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faXmark } from '#/renderer/src/fontawesome';
import { METHOD_CLASSES, requestTabItem } from '#/renderer/src/ui/shared/classes';

interface Props {
  /**
   * Tab data and draft state to render.
   */
  tab: RequestTab;

  /**
   * Whether this tab is the currently selected tab.
   */
  active: boolean;

  /**
   * Roving tabindex for the tab control: `0` when selected, `-1` otherwise.
   */
  tabIndex: number;

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
 * Renders a compact spinner for tabs with an in-flight request.
 */
function SendingIndicator(): JSX.Element {
  return (
    <span
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"
      role="status"
      aria-label="Sending…"
    >
      <svg
        className="h-3 w-3 animate-spin text-accent"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </span>
  );
}

/**
 * Builds the accessible name for a request tab, including unsaved state.
 *
 * @param tab - Tab whose label is composed for screen readers.
 * @returns Comma-separated method, name, and optional unsaved suffix.
 */
function requestTabAccessibleName(tab: RequestTab): string {
  const parts = [tab.draft.method, tab.draft.name];
  if (isTabDirty(tab)) parts.push('unsaved');
  return parts.join(', ');
}

/**
 * Single request tab with method badge, dirty indicator, and close button.
 */
export function TabItem({ tab, active, tabIndex, onSelect, onClose }: Props): JSX.Element {
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

  return (
    <div
      role="tab"
      id={`request-tab-${tab.tabId}`}
      aria-controls={`request-tabpanel-${tab.tabId}`}
      aria-selected={active}
      aria-label={requestTabAccessibleName(tab)}
      tabIndex={tabIndex}
      className={`group -mb-1 flex max-w-[220px] shrink-0 cursor-pointer self-stretch items-stretch gap-1.5 rounded-t-md border border-b-0 px-4 ${requestTabItem(active)}`}
      onClick={() => onSelect(tab.tabId)}
      onKeyDown={handleTabKeyDown}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-inherit app-no-drag">
        <span
          className={`shrink-0 px-1 py-px text-[14px] ${METHOD_CLASSES[tab.draft.method.toLowerCase()] ?? 'text-info'}`}
        >
          {tab.draft.method}
        </span>
        {tab.sending && <SendingIndicator />}
        {isTabDirty(tab) && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted" aria-hidden="true" />
        )}
        <span className="truncate text-[14px]">{tab.draft.name}</span>
      </span>
      <button
        type="button"
        className="inline-flex aspect-square shrink-0 cursor-pointer items-center justify-center self-stretch rounded-md border-none bg-transparent text-[14px] text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:opacity-100 hover:bg-selection hover:text-text app-no-drag"
        title="Close tab"
        aria-label="Close tab"
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.tabId);
        }}
      >
        <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
