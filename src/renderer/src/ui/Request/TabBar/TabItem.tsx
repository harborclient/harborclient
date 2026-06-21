import type { JSX } from 'react';
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
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" title="Sending…">
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
 * Single request tab with method badge, dirty indicator, and close button.
 */
export function TabItem({ tab, active, onSelect, onClose }: Props): JSX.Element {
  return (
    <div
      className={`group -mb-1 flex max-w-[220px] shrink-0 self-stretch items-stretch gap-1.5 rounded-t-md border border-b-0 px-4 ${requestTabItem(active)}`}
    >
      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 py-2 text-inherit app-no-drag"
        onClick={() => onSelect(tab.tabId)}
      >
        <span
          className={`shrink-0 rounded px-1 py-px text-[10px] font-semibold ${METHOD_CLASSES[tab.draft.method.toLowerCase()] ?? 'bg-info text-white'}`}
        >
          {tab.draft.method}
        </span>
        {tab.sending && <SendingIndicator />}
        {isTabDirty(tab) && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted" title="Unsaved changes" />
        )}
        <span className="truncate text-[13px]">{tab.draft.name}</span>
      </button>
      <button
        className="inline-flex aspect-square shrink-0 cursor-pointer items-center justify-center self-stretch rounded-md border-none bg-transparent text-[14px] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-selection hover:text-text app-no-drag"
        title="Close tab"
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
